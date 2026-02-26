import Redis from 'ioredis';
import { logger } from './logging/structured-logger';

// Try to grab standard Redis URL, otherwise connect to local fallback
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = new Redis(redisUrl, {
    maxRetriesPerRequest: 0, // Fail fast on commands if disconnected
    retryStrategy: (times) => {
        if (times > 5) {
            logger.warn('Redis unavailable after 5 retries. Proceeding without cache.');
            return null; // Stop retrying
        }
        logger.warn(`Redis connection retry attempt: ${times}`);
        return Math.min(times * 50, 2000);
    },
});

redisClient.on('error', (err) => {
    logger.error('Redis Client Error', { error: err.message });
});

redisClient.on('connect', () => {
    logger.info('Connected to Redis safely');
});

/**
 * Ensures clean shutdown
 */
export async function closeRedis() {
    await redisClient.quit();
}
