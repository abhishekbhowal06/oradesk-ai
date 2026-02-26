/**
 * FILLER AUDIO CACHE — "OPERATION SIREN" Phase 3
 *
 * Pre-generated audio for common filler phrases.
 * These are played INSTANTLY while tools execute, so the patient
 * never hears dead silence during database queries.
 *
 * Architecture:
 * - On server start, generate audio for all filler phrases via ElevenLabs REST API
 * - Cache them as base64 µ-law 8kHz strings in memory
 * - Stream handler grabs a cached filler and pushes it to Twilio immediately
 *
 * Fallback:
 * - If ElevenLabs is unavailable, fall back to Twilio <Say> (robotic but functional)
 * - Fillers are generated lazily — if cache misses, a fallback text is returned
 */

import { logger } from '../lib/logging/structured-logger';

// ── Filler Definitions ──────────────────────────────────────

export interface FillerEntry {
  /** Unique key for lookup */
  key: string;
  /** The text to speak */
  text: string;
  /** Context when this filler should be used */
  context:
    | 'tool_checkAvailability'
    | 'tool_bookAppointment'
    | 'tool_escalateToHuman'
    | 'thinking'
    | 'acknowledgement';
  /** Pre-generated base64 audio (µ-law 8kHz), null until generated */
  audioBase64: string | null;
  /** Whether this filler has been generated */
  isReady: boolean;
}

const FILLER_DEFINITIONS: FillerEntry[] = [
  // Tool: checkAvailability
  {
    key: 'check_1',
    text: 'Hmm, let me check our schedule for you...',
    context: 'tool_checkAvailability',
    audioBase64: null,
    isReady: false,
  },
  {
    key: 'check_2',
    text: 'Just a second, looking up available times...',
    context: 'tool_checkAvailability',
    audioBase64: null,
    isReady: false,
  },
  {
    key: 'check_3',
    text: 'Let me pull up what we have open...',
    context: 'tool_checkAvailability',
    audioBase64: null,
    isReady: false,
  },

  // Tool: bookAppointment
  {
    key: 'book_1',
    text: "Perfect, I'm booking that for you right now...",
    context: 'tool_bookAppointment',
    audioBase64: null,
    isReady: false,
  },
  {
    key: 'book_2',
    text: 'One moment while I secure that slot...',
    context: 'tool_bookAppointment',
    audioBase64: null,
    isReady: false,
  },
  {
    key: 'book_3',
    text: 'Let me lock that in for you...',
    context: 'tool_bookAppointment',
    audioBase64: null,
    isReady: false,
  },

  // Tool: escalateToHuman
  {
    key: 'escalate_1',
    text: 'Let me connect you with our team right away...',
    context: 'tool_escalateToHuman',
    audioBase64: null,
    isReady: false,
  },
  {
    key: 'escalate_2',
    text: "I'm transferring you to someone who can help directly...",
    context: 'tool_escalateToHuman',
    audioBase64: null,
    isReady: false,
  },

  // Generic thinking
  {
    key: 'think_1',
    text: 'Let me check on that...',
    context: 'thinking',
    audioBase64: null,
    isReady: false,
  },
  {
    key: 'think_2',
    text: 'Okay, one moment...',
    context: 'thinking',
    audioBase64: null,
    isReady: false,
  },
  {
    key: 'think_3',
    text: 'Looking that up for you...',
    context: 'thinking',
    audioBase64: null,
    isReady: false,
  },

  // Acknowledgements
  {
    key: 'ack_1',
    text: 'Mm-hmm...',
    context: 'acknowledgement',
    audioBase64: null,
    isReady: false,
  },
  { key: 'ack_2', text: 'I see...', context: 'acknowledgement', audioBase64: null, isReady: false },
  {
    key: 'ack_3',
    text: 'Got it...',
    context: 'acknowledgement',
    audioBase64: null,
    isReady: false,
  },
];

// ── In-Memory Cache ─────────────────────────────────────────

const fillerCache: Map<string, FillerEntry> = new Map();

// Initialize the map with definitions
for (const filler of FILLER_DEFINITIONS) {
  fillerCache.set(filler.key, filler);
}

// ── Generate Fillers on Server Start ────────────────────────

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';

/**
 * Pre-generate all filler audio clips via ElevenLabs REST API.
 * Called once on server startup. Non-blocking — failures are tolerated.
 *
 * Uses REST (not WebSocket) because these are short, one-shot generations
 * that we want to cache permanently in memory.
 */
export async function warmFillerCache(): Promise<void> {
  if (!ELEVENLABS_API_KEY) {
    logger.warn('FillerCache: ELEVENLABS_API_KEY not set — fillers will use Twilio TTS fallback');
    return;
  }

  logger.info(`FillerCache: Warming ${FILLER_DEFINITIONS.length} filler audio clips...`);

  const results = await Promise.allSettled(
    FILLER_DEFINITIONS.map((filler) => generateFillerAudio(filler)),
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  logger.info(
    `FillerCache: Warmed ${succeeded}/${FILLER_DEFINITIONS.length} fillers (${failed} failed)`,
  );
}

/**
 * Generate a single filler audio clip and cache it.
 */
async function generateFillerAudio(filler: FillerEntry): Promise<void> {
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=ulaw_8000`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: filler.text,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    filler.audioBase64 = base64Audio;
    filler.isReady = true;
    fillerCache.set(filler.key, filler);

    logger.debug(`FillerCache: Generated "${filler.key}" (${base64Audio.length} bytes b64)`);
  } catch (error) {
    logger.warn(`FillerCache: Failed to generate "${filler.key}"`, {
      error: (error as Error).message,
    });
  }
}

// ── Public API ──────────────────────────────────────────────

/**
 * Get a pre-cached filler audio for a tool call.
 * Returns the base64 µ-law audio string, or null if not cached.
 *
 * @param toolName - The tool being executed (e.g., 'checkAvailability')
 * @returns { text, audioBase64 } — text for Twilio fallback, audio for ElevenLabs
 */
export function getFillerForTool(toolName: string): { text: string; audioBase64: string | null } {
  const contextKey = `tool_${toolName}` as FillerEntry['context'];

  // Find all cached fillers for this context
  const candidates = Array.from(fillerCache.values()).filter((f) => f.context === contextKey);

  if (candidates.length === 0) {
    // Fallback to thinking fillers
    const thinkingCandidates = Array.from(fillerCache.values()).filter(
      (f) => f.context === 'thinking',
    );
    const fallback = thinkingCandidates[Math.floor(Math.random() * thinkingCandidates.length)];
    return {
      text: fallback?.text || 'One moment...',
      audioBase64: fallback?.audioBase64 || null,
    };
  }

  // Pick a random one
  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  return {
    text: selected.text,
    audioBase64: selected.audioBase64,
  };
}

/**
 * Get a pre-cached acknowledgement filler.
 */
export function getAcknowledgementFiller(): { text: string; audioBase64: string | null } {
  const candidates = Array.from(fillerCache.values()).filter(
    (f) => f.context === 'acknowledgement' && f.isReady,
  );

  if (candidates.length === 0) {
    return { text: 'Mm-hmm', audioBase64: null };
  }

  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  return { text: selected.text, audioBase64: selected.audioBase64 };
}

/**
 * Get a pre-cached thinking filler.
 */
export function getThinkingFiller(): { text: string; audioBase64: string | null } {
  const candidates = Array.from(fillerCache.values()).filter(
    (f) => f.context === 'thinking' && f.isReady,
  );

  if (candidates.length === 0) {
    return { text: 'One moment...', audioBase64: null };
  }

  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  return { text: selected.text, audioBase64: selected.audioBase64 };
}

/**
 * Check how many fillers are cached and ready.
 */
export function getFillerCacheStats(): { total: number; ready: number; contexts: string[] } {
  const entries = Array.from(fillerCache.values());
  return {
    total: entries.length,
    ready: entries.filter((e) => e.isReady).length,
    contexts: [...new Set(entries.map((e) => e.context))],
  };
}
