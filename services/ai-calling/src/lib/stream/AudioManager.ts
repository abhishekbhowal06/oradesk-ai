import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { logger } from '../logging/structured-logger';
import { LatencyMonitor, StreamingConversationManager } from '../realtime-conversation';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';

export interface AudioCallbacks {
    onPartialTranscript: (transcript: string) => Promise<void>;
    onFinalTranscript: (transcript: string, detectedLang: string) => Promise<void>;
    onSpeechStarted: () => void;
    onError: (error: Error) => void;
}

export class AudioManager {
    private deepgramLive: any = null;
    public isConnected = false;
    private latency: LatencyMonitor;
    private conversation: StreamingConversationManager;
    private callbacks: AudioCallbacks;

    constructor(
        latencyMonitor: LatencyMonitor,
        conversationMgr: StreamingConversationManager,
        callbacks: AudioCallbacks
    ) {
        this.latency = latencyMonitor;
        this.conversation = conversationMgr;
        this.callbacks = callbacks;
    }

    public async initialize(): Promise<boolean> {
        if (!DEEPGRAM_API_KEY) {
            logger.error('Deepgram API key not configured');
            return false;
        }

        try {
            logger.info('Initializing Deepgram Live STT (nova-2-general + multilingual)');
            const deepgramClient = createClient(DEEPGRAM_API_KEY);

            this.deepgramLive = deepgramClient.listen.live({
                model: 'nova-2-general',
                detect_language: true,
                smart_format: true,
                interim_results: true,
                vad_events: true,
                endpointing: 300,
                punctuate: true,
                diarize: false,
                sample_rate: 8000,
                encoding: 'mulaw',
                channels: 1,
            });

            this.deepgramLive.on(LiveTranscriptionEvents.Transcript, async (data: any) => {
                const transcript = data.channel.alternatives[0].transcript;
                const isFinal = data.is_final;
                const detectedLang = data.channel?.alternatives?.[0]?.languages?.[0] || 'en';

                if (!transcript) return;

                if (!isFinal) {
                    this.latency.mark('stt_first_word');
                    await this.callbacks.onPartialTranscript(transcript);
                } else {
                    this.latency.mark('stt_final');
                    this.latency.mark('patient_stopped');
                    await this.callbacks.onFinalTranscript(transcript, detectedLang);
                }
            });

            this.deepgramLive.on(LiveTranscriptionEvents.SpeechStarted, () => {
                this.latency.mark('patient_speaking_start');
                this.conversation.onPatientInterrupt();
                this.callbacks.onSpeechStarted();
            });

            this.deepgramLive.on(LiveTranscriptionEvents.Error, (error: any) => {
                logger.error('Deepgram error', { error });
                this.callbacks.onError(error);
            });

            return new Promise((resolve) => {
                this.deepgramLive.on(LiveTranscriptionEvents.Open, () => {
                    this.isConnected = true;
                    logger.info('Deepgram Live connected');
                    resolve(true);
                });

                // Timeout
                setTimeout(() => { if (!this.isConnected) resolve(false); }, 5000);
            });
        } catch (error) {
            logger.error('Failed to initialize Deepgram', { error });
            return false;
        }
    }

    public async sendAudio(base64Payload: string) {
        if (!this.deepgramLive || !this.isConnected) return;
        try {
            const { globalAudioWorkerPool } = require('./AudioWorkerPool');
            const audioData = await globalAudioWorkerPool.decodeBase64(base64Payload);
            this.deepgramLive.send(audioData);
        } catch (error) {
            logger.error('Failed to send audio to Deepgram', { error });
        }
    }

    public cleanup() {
        if (this.deepgramLive) {
            this.deepgramLive.finish();
        }
        this.isConnected = false;

        try {
            const { globalAudioWorkerPool } = require('./AudioWorkerPool');
            // We do NOT call pool cleanup here, because the pool is global for all calls!
            // Global pool ensures we do not overload the Node event loop by spawning 12 threads per call.
            // Pool outlives the AudioManager instance.
        } catch (e) { }
    }
}
