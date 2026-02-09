/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures by stopping requests to failing services.
 * Used to wrap Twilio, Gemini, and other external service calls.
 */

import { logger } from './logger';

export interface CircuitBreakerConfig {
    name: string;
    failureThreshold: number;      // Number of failures before opening circuit
    resetTimeoutMs: number;        // Time before trying again (half-open)
    halfOpenRequests: number;      // Number of test requests in half-open state
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
    private state: CircuitState = 'closed';
    private failureCount: number = 0;
    private successCount: number = 0;
    private lastFailureTime: number | null = null;
    private halfOpenAttempts: number = 0;

    constructor(private config: CircuitBreakerConfig) { }

    /**
     * Get current circuit state
     */
    getState(): CircuitState {
        this.checkStateTransition();
        return this.state;
    }

    /**
     * Check if circuit should transition states
     */
    private checkStateTransition(): void {
        if (this.state === 'open' && this.lastFailureTime) {
            const elapsed = Date.now() - this.lastFailureTime;
            if (elapsed >= this.config.resetTimeoutMs) {
                this.state = 'half-open';
                this.halfOpenAttempts = 0;
                logger.info(`Circuit ${this.config.name} transitioning to half-open`);
            }
        }
    }

    /**
     * Execute a function with circuit breaker protection
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        this.checkStateTransition();

        if (this.state === 'open') {
            throw new CircuitOpenError(
                `Circuit ${this.config.name} is OPEN. Service unavailable.`,
                this.config.name
            );
        }

        try {
            const result = await fn();
            this.recordSuccess();
            return result;
        } catch (error) {
            this.recordFailure();
            throw error;
        }
    }

    /**
     * Record a successful call
     */
    private recordSuccess(): void {
        this.successCount++;

        if (this.state === 'half-open') {
            this.halfOpenAttempts++;
            if (this.halfOpenAttempts >= this.config.halfOpenRequests) {
                // Enough successful requests in half-open, close the circuit
                this.state = 'closed';
                this.failureCount = 0;
                this.lastFailureTime = null;
                logger.info(`Circuit ${this.config.name} closed after successful recovery`);
            }
        }
    }

    /**
     * Record a failed call
     */
    private recordFailure(): void {
        this.failureCount++;
        this.lastFailureTime = Date.now();

        if (this.state === 'half-open') {
            // Any failure in half-open immediately opens the circuit
            this.state = 'open';
            this.halfOpenAttempts = 0;
            logger.warn(`Circuit ${this.config.name} opened after half-open failure`);
        } else if (this.failureCount >= this.config.failureThreshold) {
            this.state = 'open';
            logger.warn(`Circuit ${this.config.name} opened after ${this.failureCount} failures`);
        }
    }

    /**
     * Get circuit breaker statistics
     */
    getStats(): {
        name: string;
        state: CircuitState;
        failureCount: number;
        successCount: number;
        lastFailureTime: number | null;
    } {
        return {
            name: this.config.name,
            state: this.getState(),
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime
        };
    }

    /**
     * Manually reset the circuit breaker
     */
    reset(): void {
        this.state = 'closed';
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.halfOpenAttempts = 0;
        logger.info(`Circuit ${this.config.name} manually reset`);
    }
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
    constructor(message: string, public circuitName: string) {
        super(message);
        this.name = 'CircuitOpenError';
    }
}

// Create circuit breakers for external services
export const twilioCircuitBreaker = new CircuitBreaker({
    name: 'twilio',
    failureThreshold: 5,
    resetTimeoutMs: 60000,  // 1 minute
    halfOpenRequests: 2
});

export const geminiCircuitBreaker = new CircuitBreaker({
    name: 'gemini',
    failureThreshold: 3,
    resetTimeoutMs: 30000,  // 30 seconds
    halfOpenRequests: 1
});

/**
 * Get health status of all circuit breakers
 */
export function getCircuitBreakerHealth(): {
    twilio: ReturnType<CircuitBreaker['getStats']>;
    gemini: ReturnType<CircuitBreaker['getStats']>;
    allHealthy: boolean;
} {
    const twilio = twilioCircuitBreaker.getStats();
    const gemini = geminiCircuitBreaker.getStats();

    return {
        twilio,
        gemini,
        allHealthy: twilio.state === 'closed' && gemini.state === 'closed'
    };
}
