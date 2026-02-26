/**
 * HIGH-QUALITY TTS PROVIDER ABSTRACTION
 *
 * Production-grade Text-to-Speech integration.
 * Uses Deepgram Aura for near-human voice quality with streaming support.
 * Falls back to Twilio TTS if Deepgram unavailable.
 */

import { logger } from './logging/structured-logger';

// TTS Provider Interface
export interface TTSProvider {
  name: string;
  synthesize(text: string): Promise<Buffer>;
  synthesizeStream?(text: string): AsyncGenerator<Buffer>;
}

// Pre-cached audio for common responses (latency masking)
const PRECACHED_RESPONSES: Map<string, Buffer> = new Map();

// Common phrases to pre-cache on startup
const PHRASES_TO_PRECACHE = [
  'Hmm',
  'Let me check on that',
  'One moment please',
  'I understand',
  'Got it',
  'Okay',
  'Perfect',
  'Thank you',
  "I'm still looking that up",
];

/**
 * Deepgram Aura TTS Provider
 * High-quality, low-latency streaming TTS
 */
export class DeepgramAuraTTS implements TTSProvider {
  name = 'deepgram-aura';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.DEEPGRAM_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('Deepgram API key not configured - TTS will use fallback');
    }
  }

  async synthesize(text: string): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error('Deepgram API key not configured');
    }

    try {
      const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-stella-en', {
        method: 'POST',
        headers: {
          Authorization: `Token ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(`Deepgram TTS failed: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      logger.error('Deepgram TTS error', { error: (error as Error).message });
      throw error;
    }
  }

  async *synthesizeStream(text: string): AsyncGenerator<Buffer> {
    if (!this.apiKey) {
      throw new Error('Deepgram API key not configured');
    }

    try {
      const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-stella-en', {
        method: 'POST',
        headers: {
          Authorization: `Token ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Deepgram TTS stream failed: ${response.status}`);
      }

      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield Buffer.from(value);
      }
    } catch (error) {
      logger.error('Deepgram TTS stream error', { error: (error as Error).message });
      throw error;
    }
  }
}

/**
 * Fallback Twilio TTS (generates TwiML command, not audio)
 * Used when high-quality TTS is unavailable
 */
export class TwilioFallbackTTS implements TTSProvider {
  name = 'twilio-fallback';

  async synthesize(text: string): Promise<Buffer> {
    // Twilio TTS doesn't return audio - it's handled server-side
    // Return a marker buffer that the stream handler interprets as "use TwiML say"
    return Buffer.from(JSON.stringify({ type: 'twilio-say', text }));
  }
}

/**
 * Get the configured TTS provider
 */
export function getTTSProvider(): TTSProvider {
  const deepgramKey = process.env.DEEPGRAM_API_KEY;

  if (deepgramKey) {
    return new DeepgramAuraTTS();
  }

  logger.warn('Using Twilio fallback TTS - voice quality will be lower');
  return new TwilioFallbackTTS();
}

/**
 * Get pre-cached audio for common phrases (latency masking)
 */
export function getPrecachedAudio(phrase: string): Buffer | undefined {
  return PRECACHED_RESPONSES.get(phrase.toLowerCase());
}

/**
 * Initialize pre-cached audio on startup
 * Call this once during server initialization
 */
export async function initializePrecachedAudio(): Promise<void> {
  const provider = getTTSProvider();

  if (provider.name === 'twilio-fallback') {
    logger.info('Skipping audio pre-caching (Twilio fallback mode)');
    return;
  }

  logger.info('Pre-caching common audio responses...');

  for (const phrase of PHRASES_TO_PRECACHE) {
    try {
      const audio = await provider.synthesize(phrase);
      PRECACHED_RESPONSES.set(phrase.toLowerCase(), audio);
      logger.debug(`Pre-cached: "${phrase}"`);
    } catch (error) {
      logger.warn(`Failed to pre-cache: "${phrase}"`, { error: (error as Error).message });
    }
  }

  logger.info(`Pre-cached ${PRECACHED_RESPONSES.size} audio responses`);
}

/**
 * Play pre-cached audio or synthesize on-demand
 */
export async function getAudioForPhrase(phrase: string): Promise<Buffer> {
  // Check cache first
  const cached = getPrecachedAudio(phrase);
  if (cached) {
    return cached;
  }

  // Synthesize on-demand
  const provider = getTTSProvider();
  return provider.synthesize(phrase);
}
