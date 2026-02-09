/**
 * MULTI-STAGE BACKCHANNEL MANAGER
 * 
 * Provides escalating audio acknowledgements during LLM processing delays.
 * Prevents the dreaded "silence" that makes patients hang up.
 * 
 * Uses pre-cached audio for instant playback.
 */

import { logger } from './logger';

// Backchannel ladder - escalating acknowledgements
export interface BackchannelStep {
    delayMs: number;
    phrase: string;
    type: 'filler' | 'acknowledgement' | 'apologetic';
}

export const BACKCHANNEL_LADDER: BackchannelStep[] = [
    { delayMs: 250, phrase: 'Hmm', type: 'filler' },
    { delayMs: 1500, phrase: 'Let me check on that', type: 'acknowledgement' },
    { delayMs: 3000, phrase: 'One moment please', type: 'acknowledgement' },
    { delayMs: 5000, phrase: "I'm still looking that up", type: 'apologetic' },
    { delayMs: 7000, phrase: "I appreciate your patience", type: 'apologetic' }
];

// Hard timeout - if AI doesn't respond in this time, escalate to human
export const AI_HARD_TIMEOUT_MS = 8000;

/**
 * Manages the backchannel ladder during AI processing
 */
export class BackchannelManager {
    private timers: NodeJS.Timeout[] = [];
    private isActive: boolean = false;
    private onSpeakCallback: ((text: string) => Promise<void>) | null = null;

    /**
     * Start the backchannel ladder.
     * Call this when AI processing begins.
     * 
     * @param onSpeak - Callback to speak a phrase
     * @param onTimeout - Callback when hard timeout reached
     */
    start(
        onSpeak: (text: string) => Promise<void>,
        onTimeout: () => Promise<void>
    ): void {
        // Clear any existing timers
        this.stop();

        this.isActive = true;
        this.onSpeakCallback = onSpeak;

        logger.debug('Backchannel ladder started');

        // Schedule each step
        for (const step of BACKCHANNEL_LADDER) {
            const timer = setTimeout(async () => {
                if (this.isActive) {
                    logger.debug(`Playing backchannel: "${step.phrase}"`, { delayMs: step.delayMs });
                    try {
                        await onSpeak(step.phrase);
                    } catch (err) {
                        logger.error('Backchannel speak error', { error: (err as Error).message });
                    }
                }
            }, step.delayMs);

            this.timers.push(timer);
        }

        // Schedule hard timeout
        const timeoutTimer = setTimeout(async () => {
            if (this.isActive) {
                logger.warn('AI hard timeout reached - escalating to human');
                this.stop();
                try {
                    await onTimeout();
                } catch (err) {
                    logger.error('Timeout callback error', { error: (err as Error).message });
                }
            }
        }, AI_HARD_TIMEOUT_MS);

        this.timers.push(timeoutTimer);
    }

    /**
     * Stop the backchannel ladder.
     * Call this when AI processing completes.
     */
    stop(): void {
        if (this.timers.length > 0) {
            logger.debug('Backchannel ladder stopped');
        }

        for (const timer of this.timers) {
            clearTimeout(timer);
        }
        this.timers = [];
        this.isActive = false;
        this.onSpeakCallback = null;
    }

    /**
     * Check if backchannel is currently active
     */
    isRunning(): boolean {
        return this.isActive;
    }
}

/**
 * Select an appropriate backchannel phrase for a given context
 */
export function selectContextualBackchannel(context: 'greeting' | 'thinking' | 'checking' | 'waiting'): string {
    const phrases: Record<string, string[]> = {
        greeting: ['Hi there', 'Hello'],
        thinking: ['Hmm', 'Let me see', 'Okay'],
        checking: ['Let me check on that', 'One moment', 'Let me look that up'],
        waiting: ["I'm still checking", "Just a moment longer", "Almost there"]
    };

    const options = phrases[context] || phrases.thinking;
    return options[Math.floor(Math.random() * options.length)];
}

/**
 * Determine if we should play a thinking noise based on elapsed time
 */
export function shouldPlayThinkingNoise(elapsedMs: number, lastNoiseAtMs: number): boolean {
    // Play a noise every 1.5 seconds after the first 250ms
    if (elapsedMs < 250) return false;
    if (elapsedMs - lastNoiseAtMs < 1500) return false;
    return true;
}

// Singleton instance
export const backchannelManager = new BackchannelManager();
