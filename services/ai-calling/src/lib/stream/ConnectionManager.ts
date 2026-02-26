import WebSocket from 'ws';
import { logger } from '../logging/structured-logger';
import { supabase } from '../supabase';
import { LatencyMonitor, StreamingConversationManager } from '../realtime-conversation';
import { BackchannelManager } from '../backchannel-manager';
import { buildPromptFromRecords, CallPurpose } from '../../config/prompts/receptionist-system';
import { ToolOrchestrator } from '../voice/ToolOrchestrator';
import { getFillerForTool, getThinkingFiller } from '../../config/fillers';
import { TTSClient } from './TTSClient';
import { AudioManager } from './AudioManager';
import { selectBackchannel } from '../realtime-conversation';

// Maximum concurrent WebSockets per instance to prevent OOM
const MAX_CONCURRENT_CONNECTIONS = 200;
let currentConnections = 0;

export function getActiveConnections(): number {
    return currentConnections;
}

interface CallContext {
    systemPrompt: string;
    clinicId: string;
    patientId: string;
    callPurpose: CallPurpose;
    callType: string;
    voiceId?: string;
}

export class ConnectionManager {
    private twilioWs!: WebSocket;
    private streamSid: string | null = null;
    private callSid: string | null = null;
    private callId: string | null = null;

    private latency!: LatencyMonitor;
    private conversation!: StreamingConversationManager;
    private backchannel!: BackchannelManager;

    private ttsClient!: TTSClient;
    private audioManager!: AudioManager;
    private orchestrator: ToolOrchestrator | null = null;

    private callContext: CallContext | null = null;
    private silenceInterval: NodeJS.Timeout | null = null;

    constructor(twilioWs: WebSocket) {
        if (currentConnections >= MAX_CONCURRENT_CONNECTIONS) {
            logger.error('Circuit Breaker: Max concurrent connections reached. Rejecting stream.');
            twilioWs.close(1013, 'Try Again Later (Max Connections)');
            return;
        }

        currentConnections++;
        this.twilioWs = twilioWs;

        this.latency = new LatencyMonitor();
        this.conversation = new StreamingConversationManager();
        this.backchannel = new BackchannelManager();

        // 1. Initialize modular TTS Client
        this.ttsClient = new TTSClient(
            this.latency,
            (base64: string) => this.sendAudioToTwilio(base64),
            (command: any) => this.sendCommandToTwilio(command)
        );

        // 2. Initialize modular Audio Manager (Deepgram STT)
        this.audioManager = new AudioManager(
            this.latency,
            this.conversation,
            {
                onPartialTranscript: async (t) => this.handlePartialTranscript(t),
                onFinalTranscript: async (t, l) => this.handleFinalTranscript(t, l),
                onSpeechStarted: () => this.handleBargeIn(),
                onError: (e) => logger.error('AudioManager Error', { error: e.message })
            }
        );

        this.bindEvents();
    }

    private bindEvents() {
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
            this.cleanup();
        });
    }

    private async handleTwilioEvent(data: any) {
        switch (data.event) {
            case 'start':
                this.streamSid = data.start.streamSid;
                this.callSid = data.start.callSid;
                this.ttsClient.setStreamSid(this.streamSid!);

                const customParams = data.start.customParameters || {};
                this.callId = customParams.call_id;
                const callType = customParams.call_type || 'confirmation';

                logger.info('Stream started via ConnectionManager', {
                    streamSid: this.streamSid,
                    callSid: this.callSid,
                    callId: this.callId,
                    activeConnections: currentConnections
                });

                // 1. Load context & check billing limit
                const contextLoaded = await this.loadCallContext(callType);
                if (!contextLoaded) return;

                // 2. Initialize Deepgram Connection
                const sttReady = await this.audioManager.initialize();
                if (!sttReady) {
                    await this.ttsClient.speak("I'm having trouble connecting to my audio engine. Let me try again later.", { priority: 'high' } as any);
                    return this.hangup();
                }

                // 3. Mount existing V2 Tool Orchestrator
                this.orchestrator = new ToolOrchestrator({
                    callId: this.callId || undefined,
                    clinicId: this.callContext!.clinicId,
                    patientId: this.callContext!.patientId,
                    systemPrompt: this.callContext!.systemPrompt
                }, {
                    onTextReady: async (t) => this.ttsClient.speak(t, this.callContext?.voiceId),
                    onToolExecution: async (tool) => {
                        const filler = getFillerForTool(tool);
                        if (filler) await this.ttsClient.speak(filler.text, this.callContext?.voiceId);
                    },
                    onFatalError: async (action) => {
                        if (action === 'hangup') {
                            await this.ttsClient.speak("I apologize, but I must end this call. A staff member will reach out to you shortly. Goodbye.");
                            setTimeout(() => this.hangup(), 4000);
                        } else {
                            await this.ttsClient.speak('Let me connect you with our team who can help.');
                        }
                    }
                });

                this.latency.mark('call_start');
                this.startSilenceMonitor();
                break;

            case 'media':
                if (data.media?.payload) {
                    this.latency.mark('audio_received');
                    this.audioManager.sendAudio(data.media.payload);
                }
                break;

            case 'stop':
                logger.info('Stream stopped via Twilio event');
                this.cleanup();
                break;

            case 'mark':
                if (data.mark?.name === 'ai_response_start') {
                    this.latency.mark('tts_playback_started');
                }
                break;
        }
    }

    // --- Transcripts & Events from AudioManager ---

    private async handlePartialTranscript(transcript: string) {
        const earlyResult = await this.conversation.onPartialTranscript(transcript);

        if (earlyResult.backchannel) {
            await this.ttsClient.speak(earlyResult.backchannel);
        }

        if (earlyResult.shouldRespond && earlyResult.response) {
            this.latency.mark('intent_ready');
            await this.ttsClient.speak(earlyResult.response);

            // Still process in background logic
            if (this.orchestrator) {
                this.orchestrator.processWithAI(transcript, 'en', (e) => this.latency.mark(e)).catch(() => { });
            }
        }
    }

    private async handleFinalTranscript(transcript: string, detectedLang: string) {
        const result = await this.conversation.onFinalTranscript(transcript);

        if (result.intent === 'pending_ai' && this.orchestrator) {
            const finalAnalysis = await this.orchestrator.processWithAI(transcript, detectedLang, (e) => this.latency.mark(e));
            if (finalAnalysis) {
                this.backchannel.stop();
                this.latency.mark('ai_complete');
                this.latency.mark('intent_ready');
            }
        } else if (result.shouldRespond) {
            this.latency.mark('intent_ready');
            setTimeout(() => this.ttsClient.speak(result.response!), result.turnGap);
        }
    }

    private handleBargeIn() {
        // 1. Clear Twilio queue
        this.sendCommandToTwilio({ event: 'clear', streamSid: this.streamSid });
        // 2. Abort active TTS 
        this.ttsClient.abort();
        // 3. Signal to orchestrator
        if (this.orchestrator) this.orchestrator.interrupt();
    }

    // --- Utilities ---

    private async loadCallContext(callType: string): Promise<boolean> {
        if (!this.callId) {
            this.callContext = {
                systemPrompt: 'You are Sarah, a dental receptionist AI.',
                clinicId: '', patientId: '', callPurpose: callType as CallPurpose, callType
            };
            return true;
        }

        const { data: call } = await supabase
            .from('ai_calls')
            .select(`*, appointments(scheduled_at, procedure_name), patients(first_name, last_name), clinics(name, ai_settings, subscription_status)`)
            .eq('id', this.callId)
            .single();

        if (!call) return false;

        const subStatus = call.clinics?.subscription_status;
        if (subStatus !== 'active' && subStatus !== 'trialing') {
            logger.warn(`Call blocked: Clinic ${call.clinic_id} sub is ${subStatus}`);
            await this.ttsClient.speak("I'm sorry, but this clinic's subscription is inactive.");
            setTimeout(() => this.hangup(), 4000);
            return false;
        }

        this.callContext = {
            systemPrompt: buildPromptFromRecords(
                call.clinics || { name: 'Practice' },
                call.patients || { first_name: 'there' },
                callType as CallPurpose,
                this.callId,
                call.appointments?.scheduled_at,
                call.appointments?.scheduled_at,
                call.appointments?.procedure_name
            ),
            clinicId: call.clinic_id,
            patientId: call.patient_id,
            callPurpose: callType as CallPurpose,
            callType,
            voiceId: (call.clinics?.ai_settings as any)?.voice_id
        };
        return true;
    }

    private sendCommandToTwilio(command: any) {
        if (this.twilioWs.readyState === WebSocket.OPEN) {
            this.twilioWs.send(JSON.stringify(command));
        }
    }

    private sendAudioToTwilio(base64Payload: string) {
        if (!this.streamSid) return;
        this.sendCommandToTwilio({
            event: 'media',
            streamSid: this.streamSid,
            media: { payload: base64Payload }
        });
    }

    private hangup() {
        this.sendCommandToTwilio({
            event: 'command',
            streamSid: this.streamSid,
            command: { type: 'hangup' }
        });
        this.cleanup();
    }

    private startSilenceMonitor() {
        this.silenceInterval = setInterval(() => {
            if (this.conversation.shouldPlaySilenceAcknowledgement()) {
                const thinkFiller = getThinkingFiller();
                if (thinkFiller.audioBase64) {
                    this.sendAudioToTwilio(thinkFiller.audioBase64);
                } else {
                    this.ttsClient.speak(selectBackchannel('thinking'));
                }
            }
        }, 500);
    }

    private cleanup() {
        if (this.silenceInterval) clearInterval(this.silenceInterval);
        this.ttsClient.abort();
        this.audioManager.cleanup();
        if (this.callId) this.latency.logMetrics(this.callId);

        currentConnections--; // Free the slot
    }
}
