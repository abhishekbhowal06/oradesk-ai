/**
 * Streaming Voice Handler for Twilio Media Streams
 * Manages bidirectional audio and real-time conversation
 */

import WebSocket from 'ws';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { StreamingConversationManager, selectBackchannel, LatencyMonitor } from './realtime-conversation';
import { analyzeIntent } from './gemini';
import { supabase } from './supabase';
import { logger } from './logger';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';

export class StreamingVoiceHandler {
    private twilioWs: WebSocket;
    private deepgramLive: any = null;
    private conversation: StreamingConversationManager;
    private latency: LatencyMonitor;

    private streamSid: string | null = null;
    private callSid: string | null = null;
    private callId: string | null = null;

    private isDeepgramConnected = false;
    private audioBuffer: Buffer[] = [];

    // PHASE 3: Interrupt handling
    private isSpeaking = false;
    private isPatientSpeaking = false;

    constructor(twilioWs: WebSocket) {
        this.twilioWs = twilioWs;
        this.conversation = new StreamingConversationManager();
        this.latency = new LatencyMonitor();

        this.init();
    }

    private async init() {
        // Set up Twilio WebSocket handlers
        this.twilioWs.on('message', async (message: string) => {
            try {
                const data = JSON.parse(message);
                await this.handleTwilioEvent(data);
            } catch (error) {
                logger.error('Error parsing Twilio message', { error });
            }
        });

        this.twilioWs.on('close', () => {
            logger.info('Twilio stream closed');
            this.cleanup();
        });

        this.twilioWs.on('error', (error) => {
            logger.error('Twilio WebSocket error', { error });
        });
    }

    private async handleTwilioEvent(data: any) {
        switch (data.event) {
            case 'connected':
                logger.info('Twilio Media Stream connected');
                break;

            case 'start':
                this.streamSid = data.start.streamSid;
                this.callSid = data.start.callSid;

                // Extract call context from custom parameters
                const customParams = data.start.customParameters || {};
                this.callId = customParams.call_id;
                const callType = customParams.call_type;

                logger.info('Stream started', {
                    streamSid: this.streamSid,
                    callSid: this.callSid,
                    callId: this.callId,
                    callType
                });

                // Initialize Deepgram Live STT
                await this.initDeepgram();
                this.latency.mark('call_start');
                break;

            case 'media':
                // Incoming audio from patient (20ms frames)
                if (this.isDeepgramConnected && data.media.payload) {
                    this.latency.mark('audio_received');
                    await this.sendToDeepgram(data.media.payload);
                }
                break;

            case 'stop':
                logger.info('Stream stopped');
                this.cleanup();
                break;

            case 'mark':
                // Audio playback markers (timing measurement)
                if (data.mark.name === 'ai_response_start') {
                    this.latency.mark('tts_playback_started');
                }
                break;
        }
    }

    private async initDeepgram() {
        if (!DEEPGRAM_API_KEY) {
            logger.error('Deepgram API key not configured');
            return;
        }

        try {
            logger.info('Initializing Deepgram Live STT');

            const deepgramClient = createClient(DEEPGRAM_API_KEY);

            this.deepgramLive = deepgramClient.listen.live({
                model: 'nova-2',
                language: 'en-US',
                smart_format: true,
                interim_results: true,  // Critical for early exits
                vad_events: true,        // Voice activity detection
                endpointing: 300,         // 300ms silence = end of utterance
                punctuate: true,
                diarize: false,               // Single speaker
                sample_rate: 8000,            // Twilio uses 8kHz
                encoding: 'mulaw',            // Twilio mulaw encoding
                channels: 1
            });

            // Handle transcription results
            this.deepgramLive.on(LiveTranscriptionEvents.Transcript, async (data: any) => {
                const transcript = data.channel.alternatives[0].transcript;
                const isFinal = data.is_final;

                if (!transcript) return;

                logger.debug('Transcription', { transcript, isFinal, callId: this.callId });

                if (!isFinal) {
                    // PHASE 2: EARLY EXIT on partial transcript
                    this.latency.mark('stt_first_word');

                    const earlyResult = await this.conversation.onPartialTranscript(transcript);

                    // Immediate backchannel if needed
                    if (earlyResult.backchannel) {
                        logger.info('Playing backchannel (masking latency)', { backchannel: earlyResult.backchannel });
                        await this.speak(earlyResult.backchannel, { priority: 'high' });
                    }

                    // EARLY EXIT: Respond immediately if confident match
                    if (earlyResult.shouldRespond && earlyResult.response) {
                        this.latency.mark('intent_ready');
                        const intentLatency = this.latency.measure('patient_stopped', 'intent_ready');

                        logger.info('EARLY EXIT matched', {
                            transcript,
                            latency: intentLatency + 'ms',
                            target: '<50ms'
                        });

                        await this.speak(earlyResult.response, { priority: 'high' });

                        // Still run full AI in background for logging/safety
                        this.processWithAI(transcript).catch(err =>
                            logger.error('Background AI processing failed', { err })
                        );

                        return; // Exit early, don't wait for final transcript
                    }
                } else {
                    // Final transcript - full processing
                    this.latency.mark('stt_final');
                    this.latency.mark('patient_stopped');
                    this.isPatientSpeaking = false; // Patient stopped speaking

                    const result = await this.conversation.onFinalTranscript(transcript);

                    if (result.intent === 'pending_ai') {
                        // Need full AI analysis (no early exit match)
                        await this.processWithAI(transcript);
                    } else if (result.shouldRespond) {
                        // Early exit matched on final (didn't match on partial)
                        this.latency.mark('intent_ready');

                        // Add natural turn gap
                        await this.delay(result.turnGap);

                        await this.speak(result.response, { priority: 'high' });

                        // Update database with outcome
                        await this.updateCallOutcome(result.intent);
                    }
                }
            });

            // Handle voice activity
            this.deepgramLive.on(LiveTranscriptionEvents.SpeechStarted, () => {
                logger.debug('Patient started speaking');
                this.latency.mark('patient_speaking_start');

                // If we're currently playing audio, interrupt ourselves
                this.conversation.onPatientInterrupt();
                this.sendClearCommand();
            });

            // Handle errors
            this.deepgramLive.on(LiveTranscriptionEvents.Error, (error: any) => {
                logger.error('Deepgram error', { error });
            });

            // Wait for connection
            await this.deepgramLive.on(LiveTranscriptionEvents.Open, () => {
                this.isDeepgramConnected = true;
                logger.info('Deepgram Live connected');
            });

            // Start monitoring for silence
            this.startSilenceMonitor();

        } catch (error) {
            logger.error('Failed to initialize Deepgram', { error });
            // Fallback: Could switch to Twilio Gather mode here
        }
    }

    private async sendToDeepgram(base64Payload: string) {
        if (!this.deepgramLive || !this.isDeepgramConnected) return;

        try {
            // Decode base64 to binary
            const audioData = Buffer.from(base64Payload, 'base64');
            this.deepgramLive.send(audioData);
        } catch (error) {
            logger.error('Failed to send audio to Deepgram', { error });
        }
    }

    /**
     * PHASE 5: PARALLEL BRAIN + HARDENED BACKCHANNEL
     * Process with AI without blocking - run in background
     * Uses multi-stage backchannel ladder to mask latency
     */
    private async processWithAI(transcript: string) {
        // Import dynamically to avoid circular dependency issues
        const { backchannelManager } = await import('./backchannel-manager');
        const { prepareForExternalAPI } = await import('./pii-redaction');

        let aiCompleted = false;

        try {
            // START BACKCHANNEL LADDER - escalating acknowledgements
            backchannelManager.start(
                // onSpeak callback
                async (phrase: string) => {
                    if (!aiCompleted) {
                        await this.speak(phrase, { priority: 'high' });
                    }
                },
                // onTimeout callback - AI took too long
                async () => {
                    if (!aiCompleted) {
                        logger.warn('AI hard timeout - escalating to human');
                        await this.speak("I'm having a bit of trouble. Let me connect you with someone who can help right away.", { priority: 'high' });
                        // Mark call for escalation
                        await supabase
                            .from('ai_calls')
                            .update({
                                escalation_required: true,
                                escalation_reason: 'AI processing timeout'
                            })
                            .eq('id', this.callId);
                    }
                }
            );

            this.latency.mark('ai_start');

            // Get call context (parallel with backchannel timer)
            const { data: call } = await supabase
                .from('ai_calls')
                .select('*, appointments(*)')
                .eq('id', this.callId)
                .single();

            const context = `Appointment: ${call?.appointments?.scheduled_at}. Procedure: ${call?.appointments?.procedure_name || 'General'}.`;

            // HIPAA: Redact PII before sending to external AI
            const redactedTranscript = prepareForExternalAPI(transcript, 'gemini');

            // Analyze with Gemini (with redacted transcript)
            const analysis = await analyzeIntent(context, redactedTranscript);

            // AI completed - stop backchannel ladder
            aiCompleted = true;
            backchannelManager.stop();

            this.latency.mark('ai_complete');
            this.latency.mark('intent_ready');

            const aiLatency = this.latency.measure('ai_start', 'ai_complete');
            logger.info(`AI processing complete: ${aiLatency}ms`, {
                intent: analysis.intent,
                confidence: analysis.confidence
            });

            // Speak AI's response
            await this.speak(analysis.response_text, { priority: 'high' });

            // Update database
            await supabase
                .from('ai_calls')
                .update({
                    transcript: { user: transcript, ai: analysis.response_text, intent: analysis.intent },
                    confidence_score: analysis.confidence,
                    escalation_required: analysis.requires_human
                })
                .eq('id', this.callId);

            // Log latency metrics
            this.latency.logMetrics(this.callId || 'unknown');

        } catch (error) {
            aiCompleted = true;
            backchannelManager.stop();
            logger.error('AI processing failed', { error });
            await this.speak("Let me connect you with our team who can help.", { priority: 'high' });
        }
    }

    private async speak(text: string, options: { priority: 'high' | 'normal' } = { priority: 'normal' }) {
        try {
            this.conversation.onResponseStart();
            this.latency.mark('tts_start');

            // TODO: Integrate streaming TTS (ElevenLabs or Azure)
            // For now, use Twilio's built-in TTS

            // Send TwiML to play text
            const twimlCommand = {
                event: 'command',
                streamSid: this.streamSid,
                command: {
                    type: 'say',
                    text: text
                }
            };

            this.twilioWs.send(JSON.stringify(twimlCommand));

            this.latency.mark('tts_first_chunk');

            logger.info('Speaking', { text, latency: this.latency.measure('patient_stopped', 'tts_first_chunk') });

        } catch (error) {
            logger.error('Failed to speak', { error });
        }
    }

    private sendClearCommand() {
        // Clear any queued audio
        const clearCommand = {
            event: 'clear',
            streamSid: this.streamSid
        };
        this.twilioWs.send(JSON.stringify(clearCommand));
    }

    private async updateCallOutcome(intent: string) {
        if (!this.callId) return;

        const outcomeMap: Record<string, string> = {
            'confirm': 'confirmed',
            'deny': 'rescheduled',
            'cancel': 'cancelled',
            'question': 'action_needed'
        };

        await supabase
            .from('ai_calls')
            .update({ outcome: outcomeMap[intent] || 'completed' })
            .eq('id', this.callId);
    }

    private startSilenceMonitor() {
        // Check every 500ms if we should play acknowledgement
        setInterval(() => {
            if (this.conversation.shouldPlaySilenceAcknowledgement()) {
                this.speak(selectBackchannel('thinking'), { priority: 'normal' });
            }
        }, 500);
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private cleanup() {
        if (this.deepgramLive) {
            this.deepgramLive.finish();
        }
        this.isDeepgramConnected = false;

        // Log final metrics
        if (this.callId) {
            this.latency.logMetrics(this.callId);
        }
    }
}
