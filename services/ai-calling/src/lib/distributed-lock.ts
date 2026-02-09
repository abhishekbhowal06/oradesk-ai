/**
 * DISTRIBUTED LOCK SERVICE
 * 
 * Prevents race conditions in autonomous engines when running multi-instance.
 * Uses database-backed locking with expiration to ensure only one instance
 * runs the critical section at a time.
 */

import { supabase } from './supabase';
import { logger } from './logger';

const LOCK_TTL_MS = 60 * 1000; // 1 minute default lock TTL

/**
 * Try to acquire a distributed lock.
 * Returns true if lock acquired, false if another instance holds it.
 */
export async function tryAcquireLock(lockKey: string, holderId: string): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);

    try {
        // First, clean up expired locks
        await supabase
            .from('distributed_locks')
            .delete()
            .lt('expires_at', now.toISOString());

        // Attempt to insert (will fail if lock exists due to PRIMARY KEY constraint)
        const { error } = await supabase
            .from('distributed_locks')
            .insert({
                lock_key: lockKey,
                holder_id: holderId,
                acquired_at: now.toISOString(),
                expires_at: expiresAt.toISOString()
            });

        if (error) {
            // Lock already held by another process
            if (error.code === '23505') { // Unique violation
                logger.debug(`Lock ${lockKey} already held by another instance`);
                return false;
            }
            logger.error('Error acquiring lock', { lockKey, error });
            return false;
        }

        logger.info(`Lock ${lockKey} acquired by ${holderId}`);
        return true;

    } catch (err) {
        logger.error('Exception acquiring lock', { lockKey, error: (err as Error).message });
        return false;
    }
}

/**
 * Release a distributed lock.
 */
export async function releaseLock(lockKey: string, holderId: string): Promise<void> {
    try {
        const { error } = await supabase
            .from('distributed_locks')
            .delete()
            .eq('lock_key', lockKey)
            .eq('holder_id', holderId);

        if (error) {
            logger.error('Error releasing lock', { lockKey, error });
        } else {
            logger.info(`Lock ${lockKey} released by ${holderId}`);
        }
    } catch (err) {
        logger.error('Exception releasing lock', { lockKey, error: (err as Error).message });
    }
}

/**
 * Extend the TTL of a held lock (heartbeat).
 */
export async function extendLock(lockKey: string, holderId: string): Promise<boolean> {
    const newExpiry = new Date(Date.now() + LOCK_TTL_MS);

    try {
        const { data, error } = await supabase
            .from('distributed_locks')
            .update({ expires_at: newExpiry.toISOString() })
            .eq('lock_key', lockKey)
            .eq('holder_id', holderId)
            .select('lock_key')
            .single();

        if (error || !data) {
            // Lock was lost (expired and taken by another)
            logger.warn(`Lock ${lockKey} extension failed - lock lost`);
            return false;
        }

        return true;
    } catch (err) {
        logger.error('Exception extending lock', { lockKey, error: (err as Error).message });
        return false;
    }
}

/**
 * Execute a function with a distributed lock.
 * Automatically acquires lock before execution and releases after.
 */
export async function withLock<T>(
    lockKey: string,
    fn: () => Promise<T>,
    options?: { skipIfLocked?: boolean }
): Promise<T | null> {
    const holderId = process.env.HOSTNAME || `node-${process.pid}-${Date.now()}`;

    const acquired = await tryAcquireLock(lockKey, holderId);

    if (!acquired) {
        if (options?.skipIfLocked) {
            logger.debug(`Skipping ${lockKey} execution - lock held by another`);
            return null;
        }
        throw new Error(`Could not acquire lock: ${lockKey}`);
    }

    try {
        return await fn();
    } finally {
        await releaseLock(lockKey, holderId);
    }
}
