import { supabaseAdmin } from './supabase';
import { logger } from './logging/structured-logger';
import { redisClient } from './redis';

const FLAG_CACHE_TTL = 600; // 10 minutes

/**
 * Checks if a specific feature flag is enabled for a clinic.
 * Logic:
 * 1. Check for clinic-specific override.
 * 2. Fall back to global flag.
 * 3. Default to false if no flag found.
 */
export async function isFeatureEnabled(flagKey: string, clinicId?: string): Promise<boolean> {
    const cacheKey = `feature_flag:${flagKey}:${clinicId || 'global'}`;

    // 1. Try Redis Cache
    try {
        const cached = await redisClient.get(cacheKey);
        if (cached !== null) {
            return cached === 'true';
        }
    } catch (err) {
        logger.warn('Feature flag cache read failed', { flagKey, error: (err as Error).message });
    }

    try {
        // 2. Query Database
        // Fetch both global and clinic-specific flags in one go
        const { data, error } = await supabaseAdmin
            .from('feature_flags')
            .select('flag_key, is_enabled, clinic_id')
            .eq('flag_key', flagKey)
            .or(`clinic_id.is.null,clinic_id.eq.${clinicId || '00000000-0000-0000-0000-000000000000'}`);

        if (error) throw error;

        // Prioritize clinic-specific flag
        const clinicFlag = data?.find(f => f.clinic_id === clinicId);
        const globalFlag = data?.find(f => f.clinic_id === null);

        const isEnabled = clinicFlag ? clinicFlag.is_enabled : (globalFlag ? globalFlag.is_enabled : false);

        // 3. Update Cache
        try {
            await redisClient.setex(cacheKey, FLAG_CACHE_TTL, String(isEnabled));
        } catch (err) {
            logger.warn('Feature flag cache write failed', { flagKey, error: (err as Error).message });
        }

        return isEnabled;
    } catch (error) {
        logger.error('Error checking feature flag', { flagKey, clinicId, error: (error as Error).message });
        return false; // Safe default
    }
}
