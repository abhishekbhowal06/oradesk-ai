import { logger } from '../logging/structured-logger';
import { TTSProvider, createTTSProvider } from '../../services/tts-provider';
import { LatencyMonitor } from '../realtime-conversation';

export class TTSClient {
    private activeTts: TTSProvider | null = null;
    private streamSid: string | null = null;
    private latency: LatencyMonitor;
    private sendAudioToTwilio: (base64: string) => void;
    private sendCommandToTwilio: (command: any) => void;

    constructor(
        latencyMonitor: LatencyMonitor,
        sendAudioCallback: (base64: string) => void,
        sendCommandCallback: (command: any) => void
    ) {
        this.latency = latencyMonitor;
        this.sendAudioToTwilio = sendAudioCallback;
        this.sendCommandToTwilio = sendCommandCallback;
    }

    public setStreamSid(sid: string) {
        this.streamSid = sid;
    }

    public async speak(text: string, voiceId?: string): Promise<void> {
        if (!this.streamSid) return;

        this.latency.mark('tts_start');

        if (TTSProvider.isAvailable()) {
            try {
                await this.speakWithProvider(text, voiceId);
                this.latency.mark('tts_first_chunk');
            } catch (error) {
                logger.error('Failed to speak via primary TTS provider', { error });
                this.speakWithTwilioFallback(text);
            }
        } else {
            this.speakWithTwilioFallback(text);
            this.latency.mark('tts_first_chunk');
        }
    }

    private async speakWithProvider(text: string, voiceId?: string): Promise<void> {
        const tts = createTTSProvider();
        this.activeTts = tts;

        return new Promise<void>((resolve, reject) => {
            tts.speak(text, {
                streamSid: this.streamSid!,
                onAudioChunk: (base64Audio: string) => {
                    this.sendAudioToTwilio(base64Audio);
                },
                onFirstByte: () => {
                    this.latency.mark('tts_first_chunk');
                },
                onComplete: () => {
                    this.activeTts = null;
                    resolve();
                },
                onError: (error: Error) => {
                    this.activeTts = null;
                    logger.error('Provider TTS stream error', { error: error.message });
                    this.speakWithTwilioFallback(text);
                    resolve();
                },
            }, voiceId).catch(reject);
        });
    }

    private speakWithTwilioFallback(text: string): void {
        const twimlCommand = {
            event: 'command',
            streamSid: this.streamSid,
            command: {
                type: 'say',
                text: text,
            },
        };
        this.sendCommandToTwilio(twimlCommand);
    }

    public abort() {
        if (this.activeTts) {
            this.activeTts.abort();
            this.activeTts = null;
            logger.info('TTS Client: Stream aborted');
        }
    }
}
