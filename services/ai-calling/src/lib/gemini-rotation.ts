/**
 * GEMINI API KEY ROTATION MODULE
 * 
 * To handle high-throughput concurrent AI calls without hitting the RPM/TPM
 * rate limits of a single Gemini API key, this module accepts a comma-separated 
 * list of keys in the GEMINI_API_KEY environment variable and provides a simple 
 * atomic round-robin load balancer.
 */

import { logger } from './logging/structured-logger';

class GeminiKeyRotation {
    private keys: string[] = [];
    private currentIndex: number = 0;

    constructor() {
        this.initializeKeys();
    }

    private initializeKeys() {
        const rawKeyString = process.env.GEMINI_API_KEY || '';
        if (!rawKeyString) {
            logger.error("Missing GEMINI_API_KEY environment variable. AI requires it.");
            return;
        }

        // Split by comma, trim whitespace, and remove empties
        this.keys = rawKeyString.split(',')
            .map(key => key.trim())
            .filter(key => key.length > 0);

        if (this.keys.length === 0) {
            logger.error('GEMINI_API_KEY was populated but no valid keys were found after parsing.');
        } else {
            logger.info(`Initialized GeminiKeyRotation with ${this.keys.length} keys.`);
        }
    }

    /**
     * Get the next API key in the rotation using atomic round-robin.
     */
    public getNextKey(): string {
        if (this.keys.length === 0) {
            return ''; // Rely on down-stream Gemini client to throw "API key missing" error
        }

        const key = this.keys[this.currentIndex];

        // Atomic loop
        this.currentIndex = (this.currentIndex + 1) % this.keys.length;

        return key;
    }

    /**
     * Get the total number of loaded keys (useful for metrics)
     */
    public getKeyCount(): number {
        return this.keys.length;
    }
}

// Export a singleton instance globally
export const geminiRoundRobin = new GeminiKeyRotation();
