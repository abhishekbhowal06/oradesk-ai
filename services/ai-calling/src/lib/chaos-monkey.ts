import { logger } from './logging/structured-logger';

type ChaosConfig = {
    latencyMs: number;
    failureRate: number; // 0.0 to 1.0
    activeServices: Set<string>;
};

/**
 * ChaosMonkey: Fail-safely inject artificial failures and latency
 * to test system resilience (Circuit Breakers, Retries, Failover).
 * 
 * USE ONLY IN STAGING/TEST ENVIRONMENTS. 
 * Disabled by default.
 */
class ChaosMonkey {
    private config: ChaosConfig = {
        latencyMs: 0,
        failureRate: 0,
        activeServices: new Set(),
    };

    private isEnabled: boolean = process.env.ENABLE_CHAOS_MONKEY === 'true';

    /**
     * Configures the chaos monkey.
     */
    configure(config: Partial<ChaosConfig>) {
        this.config = { ...this.config, ...config };
        logger.warn('ChaosMonkey configuration updated', { config: this.config });
    }

    /**
     * Resets all chaos settings.
     */
    reset() {
        this.config = {
            latencyMs: 0,
            failureRate: 0,
            activeServices: new Set(),
        };
        logger.info('ChaosMonkey reset to normal operation');
    }

    /**
     * Check if a specific service call should experience chaos.
     * If so, it might delay or throw an error.
     */
    async handleChaos(serviceName: string): Promise<void> {
        if (!this.isEnabled) return;
        if (!this.config.activeServices.has(serviceName) && !this.config.activeServices.has('*')) return;

        // 1. Inject Latency
        if (this.config.latencyMs > 0) {
            await new Promise(resolve => setTimeout(resolve, this.config.latencyMs));
        }

        // 2. Inject Failure
        if (this.config.failureRate > 0 && Math.random() < this.config.failureRate) {
            logger.error('ChaosMonkey injecting failure', { serviceName });
            throw new Error(`CHAOS_MONKEY_FAILURE: Artificial failure injected for ${serviceName}`);
        }
    }

    getStatus() {
        return {
            enabled: this.isEnabled,
            config: {
                ...this.config,
                activeServices: Array.from(this.config.activeServices),
            },
        };
    }
}

export const chaosMonkey = new ChaosMonkey();
