/**
 * TTS PROVIDER — "OPERATION SIREN"
 *
 * ElevenLabs WebSocket streaming TTS for the dental AI receptionist.
 * Uses eleven_turbo_v2_5 for lowest latency with µ-law 8kHz output
 * (exactly what Twilio Media Streams expects).
 *
 * Architecture:
 * 1. Open WS to ElevenLabs with voice_id + model
 * 2. Send text chunks immediately (no buffering)
 * 3. Receive audio chunks → base64-encode → push to Twilio as media messages
 * 4. On barge-in: close WS, clear buffers, send Twilio clear command
 *
 * WebSocket URL:
 *   wss://api.elevenlabs.io/v1/text-to-speech/{voice_id}/stream-input
 *     ?model_id=eleven_turbo_v2_5
 *     &output_format=ulaw_8000
 *     &inactivity_timeout=20
 */

import WebSocket from 'ws';
import { logger } from '../lib/logging/structured-logger';

// ── Configuration ───────────────────────────────────────────

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';

// Sarah's voice — Rachel (professional, warm female)
// Can be overridden via env for A/B testing different voices
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

// Turbo v2.5 — lowest latency model
const MODEL_ID = 'eleven_turbo_v2_5';

// Twilio requires µ-law at 8000 Hz
const OUTPUT_FORMAT = 'ulaw_8000';

// Close WS if no text sent for 20 seconds
const INACTIVITY_TIMEOUT = 20;

// ── Types ───────────────────────────────────────────────────

export interface TTSStreamOptions {
  /** Twilio stream SID for targeting media messages */
  streamSid: string;
  /** Callback when audio chunk is ready (base64 µ-law 8kHz) */
  onAudioChunk: (base64Audio: string) => void;
  /** Callback when the entire utterance is done */
  onComplete: () => void;
  /** Callback when first audio byte arrives (for latency measurement) */
  onFirstByte?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface TTSMetrics {
  /** Time from text sent to first audio byte received (ms) */
  timeToFirstByte: number;
  /** Total duration of TTS generation (ms) */
  totalDuration: number;
  /** Number of audio chunks received */
  chunkCount: number;
  /** Total bytes of audio generated */
  totalBytes: number;
}

// ── ElevenLabs WebSocket Message Types ──────────────────────

interface ElevenLabsAudioMessage {
  audio?: string; // base64-encoded audio chunk
  isFinal?: boolean; // true on the last chunk
  normalizedAlignment?: {
    chars: string[];
    charStartTimesMs: number[];
    charDurationsMs: number[];
  };
}

// ── TTS Provider Class ──────────────────────────────────────

export class TTSProvider {
  private ws: WebSocket | null = null;
  private isConnected = false;
  private isAborted = false;
  private options: TTSStreamOptions | null = null;

  // Metrics
  private textSentAt = 0;
  private firstByteAt = 0;
  private chunkCount = 0;
  private totalBytes = 0;

  /**
   * Check if ElevenLabs is configured.
   * Falls back to Twilio TTS if not.
   */
  static isAvailable(): boolean {
    return !!ELEVENLABS_API_KEY;
  }

  /**
   * Stream text to speech via ElevenLabs WebSocket.
   * Opens a new WS connection per utterance for clean lifecycle.
   *
   * @param text - Full text to speak (can also be sent in chunks via sendChunk)
   * @param options - Callbacks for audio chunks, completion, errors
   * @param voiceId - Optional voice ID to use (overrides default)
   */
  async speak(text: string, options: TTSStreamOptions, voiceId?: string): Promise<TTSMetrics> {
    this.options = options;
    this.isAborted = false;
    this.chunkCount = 0;
    this.totalBytes = 0;
    this.firstByteAt = 0;

    const targetVoiceId = voiceId || VOICE_ID;

    return new Promise<TTSMetrics>((resolve, reject) => {
      if (!ELEVENLABS_API_KEY) {
        reject(new Error('ELEVENLABS_API_KEY not configured'));
        return;
      }

      const wsUrl =
        `wss://api.elevenlabs.io/v1/text-to-speech/${targetVoiceId}/stream-input` +
        `?model_id=${MODEL_ID}` +
        `&output_format=${OUTPUT_FORMAT}` +
        `&inactivity_timeout=${INACTIVITY_TIMEOUT}`;

      logger.info('ElevenLabs TTS: Opening WebSocket', {
        voiceId: VOICE_ID,
        model: MODEL_ID,
        format: OUTPUT_FORMAT,
      });

      this.ws = new WebSocket(wsUrl, {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      });

      this.ws.on('open', () => {
        this.isConnected = true;
        logger.debug('ElevenLabs TTS: WebSocket connected');

        // Send the BOS (Beginning of Stream) message with voice settings
        const bosMessage = {
          text: ' ', // Required initial message
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0, // No style exaggeration (faster)
            use_speaker_boost: true,
          },
          generation_config: {
            chunk_length_schedule: [120, 160, 250, 290], // Optimized for low latency
          },
        };

        this.ws!.send(JSON.stringify(bosMessage));

        // Send the actual text
        this.textSentAt = Date.now();
        this.ws!.send(
          JSON.stringify({
            text: text,
            flush: true, // Flush immediately for lowest latency
          }),
        );

        // Send EOS (End of Stream) — tells ElevenLabs this is the complete text
        this.ws!.send(JSON.stringify({ text: '' }));
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        if (this.isAborted) return;

        try {
          const message: ElevenLabsAudioMessage = JSON.parse(data.toString());

          if (message.audio) {
            // Track first byte latency
            if (this.chunkCount === 0) {
              this.firstByteAt = Date.now();
              const ttfb = this.firstByteAt - this.textSentAt;
              logger.info(`ElevenLabs TTS: First byte in ${ttfb}ms`);
              options.onFirstByte?.();
            }

            this.chunkCount++;

            // audio is already base64 from ElevenLabs
            const audioBase64 = message.audio;
            this.totalBytes += audioBase64.length * 0.75; // Approximate decoded size

            // Push to callback (which sends to Twilio)
            options.onAudioChunk(audioBase64);
          }

          if (message.isFinal) {
            logger.info('ElevenLabs TTS: Stream complete', {
              chunks: this.chunkCount,
              totalBytes: this.totalBytes,
              ttfb: this.firstByteAt - this.textSentAt,
              totalDuration: Date.now() - this.textSentAt,
            });

            options.onComplete();
            this.closeConnection();

            resolve({
              timeToFirstByte: this.firstByteAt - this.textSentAt,
              totalDuration: Date.now() - this.textSentAt,
              chunkCount: this.chunkCount,
              totalBytes: this.totalBytes,
            });
          }
        } catch (error) {
          logger.error('ElevenLabs TTS: Failed to parse message', { error });
        }
      });

      this.ws.on('error', (error) => {
        logger.error('ElevenLabs TTS: WebSocket error', { error: error.message });
        this.isConnected = false;
        options.onError?.(error);
        reject(error);
      });

      this.ws.on('close', (code, reason) => {
        this.isConnected = false;
        logger.debug('ElevenLabs TTS: WebSocket closed', {
          code,
          reason: reason.toString(),
        });

        // If we haven't resolved yet (abnormal close), resolve with partial metrics
        if (this.chunkCount > 0) {
          resolve({
            timeToFirstByte: this.firstByteAt - this.textSentAt,
            totalDuration: Date.now() - this.textSentAt,
            chunkCount: this.chunkCount,
            totalBytes: this.totalBytes,
          });
        }
      });
    });
  }

  /**
   * Send additional text chunk to an open stream.
   * Use for sentence-by-sentence streaming from Gemini.
   */
  sendChunk(text: string, flush: boolean = false): void {
    if (!this.ws || !this.isConnected || this.isAborted) return;

    this.ws.send(
      JSON.stringify({
        text,
        flush,
      }),
    );
  }

  /**
   * Signal end of text input.
   * ElevenLabs will flush remaining audio.
   */
  endStream(): void {
    if (!this.ws || !this.isConnected || this.isAborted) return;

    this.ws.send(JSON.stringify({ text: '' }));
  }

  /**
   * BARGE-IN: Immediately stop TTS and close the connection.
   * Called when the patient interrupts Sarah.
   */
  abort(): void {
    logger.info('ElevenLabs TTS: ABORTED (barge-in)');
    this.isAborted = true;
    this.closeConnection();
  }

  /**
   * Check if a stream is currently active.
   */
  isStreaming(): boolean {
    return this.isConnected && !this.isAborted;
  }

  /**
   * Clean shutdown of the WebSocket connection.
   */
  private closeConnection(): void {
    if (this.ws) {
      try {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.close(1000, 'Stream complete');
        }
      } catch {
        // Ignore close errors
      }
      this.ws = null;
    }
    this.isConnected = false;
  }
}

// ── Singleton Factory ───────────────────────────────────────

let _instance: TTSProvider | null = null;

/**
 * Get a TTSProvider instance.
 * Creates a new instance per call (each speak() opens its own WS).
 */
export function createTTSProvider(): TTSProvider {
  return new TTSProvider();
}

/**
 * Get a reusable singleton for simple use cases.
 */
export function getTTSProvider(): TTSProvider {
  if (!_instance) {
    _instance = new TTSProvider();
  }
  return _instance;
}
