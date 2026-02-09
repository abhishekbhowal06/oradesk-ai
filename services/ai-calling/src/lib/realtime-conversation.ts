/**
 * REAL-TIME CONVERSATION ENGINE
 * 
 * Streaming, low-latency conversational AI for phone calls.
 * Target: <300ms perceived latency through early exits and behavioral techniques.
 */

import { logger } from './logger';
import { checkEmergency, checkProhibitedTopics } from './safety-boundaries';

// =========================================================================
// TIER 1: EARLY EXIT PATTERNS (0-50ms latency)
// =========================================================================

export interface EarlyExitResult {
    matched: boolean;
    intent: string;
    confidence: number;
    responseText: string;
}

const EARLY_EXIT_PATTERNS = {
    // Confirmation patterns
    confirm: {
        patterns: [
            /^(yes|yeah|yep|yup|sure|okay|ok|correct|right|absolutely|definitely|sounds good)/i,
            /^(i can|i'll be there|that works|perfect)/i
        ],
        response: "Great! Your appointment is confirmed. We'll see you then."
    },

    // Denial patterns
    deny: {
        patterns: [
            /^(no|nope|nah|not really|i can't|cannot|won't be able)/i
        ],
        response: "I understand. Let me connect you with our team to reschedule."
    },

    // Cancellation patterns
    cancel: {
        patterns: [
            /^(cancel|don't want|not interested|never mind|forget it)/i
        ],
        response: "I've noted your cancellation request. A staff member will follow up with you."
    },

    // Questions (require human)
    question: {
        patterns: [
            /^(what|when|where|how|why|who|can you|could you|will|is it)/i
        ],
        response: "Let me get someone who can answer that for you."
    }
};

/**
 * Attempt early exit from partial transcript
 * Returns null if no confident match
 */
export function attemptEarlyExit(partialTranscript: string): EarlyExitResult | null {
    const text = partialTranscript.trim().toLowerCase();

    // Must be at least 2 characters to avoid false positives
    if (text.length < 2) return null;

    for (const [intent, config] of Object.entries(EARLY_EXIT_PATTERNS)) {
        for (const pattern of config.patterns) {
            if (pattern.test(text)) {
                return {
                    matched: true,
                    intent,
                    confidence: 95,
                    responseText: config.response
                };
            }
        }
    }

    return null;
}


// =========================================================================
// BACKCHANNEL SOUNDS (Mask Processing Latency)
// =========================================================================

export type BackchannelType = 'acknowledgement' | 'thinking' | 'clarifying' | 'empathy';

const BACKCHANNEL_LIBRARY = {
    acknowledgement: [
        "mm-hmm",
        "okay",
        "I see",
        "got it",
        "alright"
    ],
    thinking: [
        "let me check that",
        "one moment",
        "just a second",
        "let me pull that up"
    ],
    clarifying: [
        "sorry?",
        "could you repeat that?",
        "I want to make sure I heard you correctly",
        "did you say"
    ],
    empathy: [
        "I understand",
        "I hear you",
        "that makes sense"
    ]
};

/**
 * Select appropriate backchannel sound based on context
 */
export function selectBackchannel(
    type: BackchannelType,
    context?: {
        transcriptLength?: number;
        previousIntent?: string;
        isPartial?: boolean;
    }
): string {
    const options = BACKCHANNEL_LIBRARY[type];

    // Use context to select most appropriate
    if (context?.isPartial) {
        // For partial transcripts, use shorter acknowledgements
        return type === 'acknowledgement'
            ? options[0] // "mm-hmm"
            : options[Math.floor(Math.random() * options.length)];
    }

    // Random selection to avoid sounding robotic
    return options[Math.floor(Math.random() * options.length)];
}


// =========================================================================
// TURN-TAKING TIMING (Perceptual Naturalness)
// =========================================================================

export const TURN_GAPS_MS = {
    QUICK_ACKNOWLEDGEMENT: 100,   // "yes" → "Great!"
    NORMAL_RESPONSE: 300,          // Natural conversational pause
    COMPLEX_THINKING: 800,         // "Let me check that for you"
    INTERRUPTABLE: 500,           // Allow patient to interrupt
    EMERGENCY: 0                   // Immediate response
};

/**
 * Calculate appropriate turn gap based on context
 */
export function calculateTurnGap(context: {
    intent: string;
    confidence: number;
    transcriptLength: number;
    isEmergency: boolean;
}): number {
    if (context.isEmergency) {
        return TURN_GAPS_MS.EMERGENCY;
    }

    // Simple confirm/deny - quick response
    if (['confirm', 'deny'].includes(context.intent) && context.confidence > 90) {
        return TURN_GAPS_MS.QUICK_ACKNOWLEDGEMENT;
    }

    // Questions or complex intents - thinking pause
    if (context.intent === 'question' || context.transcriptLength > 50) {
        return TURN_GAPS_MS.COMPLEX_THINKING;
    }

    // Default natural pause
    return TURN_GAPS_MS.NORMAL_RESPONSE;
}


// =========================================================================
// STREAMING CONVERSATION STATE MACHINE
// =========================================================================

export enum ConversationPhase {
    LISTENING = 'listening',
    PROCESSING = 'processing',
    RESPONDING = 'responding',
    WAITING_FOR_TURN = 'waiting_for_turn'
}

export interface StreamingState {
    phase: ConversationPhase;
    partialTranscript: string;
    finalTranscript: string;
    currentIntent: string | null;
    confidence: number;
    lastSpeechTimestamp: number;
    lastBackchannelTimestamp: number;
    isPatientSpeaking: boolean;
    responseStarted: boolean;
}

export class StreamingConversationManager {
    private state: StreamingState;
    private silenceThreshold = 2000; // 2 seconds of silence triggers action
    private backchannelCooldown = 3000; // Don't spam backchannels

    constructor() {
        this.state = {
            phase: ConversationPhase.LISTENING,
            partialTranscript: '',
            finalTranscript: '',
            currentIntent: null,
            confidence: 0,
            lastSpeechTimestamp: Date.now(),
            lastBackchannelTimestamp: 0,
            isPatientSpeaking: false,
            responseStarted: false
        };
    }

    /**
     * Handle partial transcription from STT
     */
    async onPartialTranscript(text: string): Promise<{
        shouldRespond: boolean;
        response?: string;
        backchannel?: string;
    }> {
        this.state.partialTranscript = text;
        this.state.lastSpeechTimestamp = Date.now();
        this.state.isPatientSpeaking = true;

        // Check for emergency phrases in partial text
        const emergencyCheck = checkEmergency(text);
        if (!emergencyCheck.safe) {
            logger.warn('Emergency detected in partial transcript', { text });
            return {
                shouldRespond: true,
                response: "I understand this is urgent. Let me connect you with our team immediately."
            };
        }

        // Attempt early exit if text is substantial
        if (text.length > 3) {
            const earlyExit = attemptEarlyExit(text);
            if (earlyExit && earlyExit.matched) {
                logger.info('Early exit matched', { intent: earlyExit.intent, text });
                return {
                    shouldRespond: true,
                    response: earlyExit.responseText
                };
            }
        }

        // Provide backchannel acknowledgement if appropriate
        const timeSinceLastBackchannel = Date.now() - this.state.lastBackchannelTimestamp;
        if (timeSinceLastBackchannel > this.backchannelCooldown && text.length > 10) {
            this.state.lastBackchannelTimestamp = Date.now();
            return {
                shouldRespond: false,
                backchannel: selectBackchannel('acknowledgement', { isPartial: true })
            };
        }

        return { shouldRespond: false };
    }

    /**
     * Handle final transcription
     */
    async onFinalTranscript(text: string): Promise<{
        shouldRespond: boolean;
        intent: string;
        response: string;
        turnGap: number;
    }> {
        this.state.finalTranscript = text;
        this.state.isPatientSpeaking = false;
        this.state.phase = ConversationPhase.PROCESSING;

        // Final safety check
        const emergencyCheck = checkEmergency(text);
        if (!emergencyCheck.safe) {
            return {
                shouldRespond: true,
                intent: 'emergency',
                response: "I understand this is urgent. Transferring you to our team now.",
                turnGap: TURN_GAPS_MS.EMERGENCY
            };
        }

        // Try early exit first
        const earlyExit = attemptEarlyExit(text);
        if (earlyExit && earlyExit.matched) {
            const turnGap = calculateTurnGap({
                intent: earlyExit.intent,
                confidence: earlyExit.confidence,
                transcriptLength: text.length,
                isEmergency: false
            });

            return {
                shouldRespond: true,
                intent: earlyExit.intent,
                response: earlyExit.responseText,
                turnGap
            };
        }

        // If no early exit, return for full AI processing
        // This will be handled by the caller who will invoke Gemini
        this.state.currentIntent = 'pending_ai';
        return {
            shouldRespond: false,
            intent: 'pending_ai',
            response: '',
            turnGap: TURN_GAPS_MS.NORMAL_RESPONSE
        };
    }

    /**
     * Check if system should play acknowledgement due to silence
     */
    shouldPlaySilenceAcknowledgement(): boolean {
        const timeSinceSpeech = Date.now() - this.state.lastSpeechTimestamp;
        const timeSinceBackchannel = Date.now() - this.state.lastBackchannelTimestamp;

        return (
            timeSinceSpeech > this.silenceThreshold &&
            timeSinceBackchannel > this.backchannelCooldown &&
            !this.state.responseStarted
        );
    }

    /**
     * Patient interrupted our response
     */
    onPatientInterrupt(): void {
        logger.info('Patient interrupted - resetting state');
        this.state.phase = ConversationPhase.LISTENING;
        this.state.responseStarted = false;
        this.state.partialTranscript = '';
        // Keep final transcript for context
    }

    /**
     * We started responding
     */
    onResponseStart(): void {
        this.state.phase = ConversationPhase.RESPONDING;
        this.state.responseStarted = true;
    }
}


// =========================================================================
// LATENCY MONITORING
// =========================================================================

export interface LatencyMetrics {
    sttFirstWord: number;
    intentPrediction: number;
    responseGeneration: number;
    ttsFirstChunk: number;
    totalPerceived: number;
}

export class LatencyMonitor {
    private metrics: Map<string, number> = new Map();

    mark(event: string): void {
        this.metrics.set(event, Date.now());
    }

    measure(from: string, to: string): number {
        const start = this.metrics.get(from);
        const end = this.metrics.get(to);

        if (!start || !end) return -1;
        return end - start;
    }

    getMetrics(): LatencyMetrics {
        return {
            sttFirstWord: this.measure('patient_stopped', 'stt_first_word'),
            intentPrediction: this.measure('stt_final', 'intent_ready'),
            responseGeneration: this.measure('intent_ready', 'response_generated'),
            ttsFirstChunk: this.measure('response_generated', 'tts_first_chunk'),
            totalPerceived: this.measure('patient_stopped', 'tts_first_chunk')
        };
    }

    /**
     * PHASE 6: COMPREHENSIVE LATENCY LOGGING
     * Outputs detailed metrics and evaluates against targets
     */
    logMetrics(callId: string): void {
        const metrics = this.getMetrics();

        const perceivedLatency = this.measure('patient_stopped', 'tts_playback_started') ||
            metrics.totalPerceived;

        const meetsTarget = perceivedLatency > 0 && perceivedLatency < 500;

        logger.info('='.repeat(60));
        logger.info(`CONVERSATIONAL LATENCY REPORT - Call ${callId}`);
        logger.info('='.repeat(60));
        logger.info('LATENCY BREAKDOWN:');
        logger.info(`  STT First Word:       ${metrics.sttFirstWord}ms`);
        logger.info(`  Intent Prediction:    ${metrics.intentPrediction}ms`);
        logger.info(`  Response Generation:  ${metrics.responseGeneration}ms`);
        logger.info(`  TTS First Chunk:      ${metrics.ttsFirstChunk}ms`);
        logger.info('─'.repeat(60));
        logger.info(`  PERCEIVED LATENCY:    ${perceivedLatency}ms (Target: <500ms)`);
        logger.info(`  STATUS:               ${meetsTarget ? '✅ TARGET MET' : '⚠️ NEEDS OPTIMIZATION'}`);
        logger.info('='.repeat(60));

        // Store metrics for analytics
        const fullMetrics = {
            callId,
            timestamp: new Date().toISOString(),
            sttFirstWord: metrics.sttFirstWord,
            intentPrediction: metrics.intentPrediction,
            responseGeneration: metrics.responseGeneration,
            ttsFirstChunk: metrics.ttsFirstChunk,
            totalPerceived: perceivedLatency,
            meetsTarget,
            target: 500
        };

        // Log as structured JSON for monitoring systems
        logger.info('latency_metrics', fullMetrics);
    }
}
