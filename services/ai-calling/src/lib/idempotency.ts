import { supabase } from './supabase';
import { logger } from './logging/structured-logger';

/**
 * Ensures a webhook event is only processed exactly once.
 * Inserts the event ID into the database. If it already exists (Unique Constraint Violation code 23505),
 * it returns false, meaning the webhook is a duplicate and should be ignored.
 *
 * @param provider 'stripe' | 'twilio' | 'vapi' | 'calendar' | 'pms'
 * @param eventId The unique event ID from the provider
 * @returns boolean True if it's a new event and safely locked, False if duplicate.
 */
export async function checkAndLockWebhook(
    provider: 'stripe' | 'twilio' | 'vapi' | 'calendar' | 'pms',
    eventId: string
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('processed_webhooks')
            .insert({ provider, event_id: eventId });

        if (error) {
            if (error.code === '23505') {
                // 23505 is PostgreSQL unique_violation
                logger.warn(`[Idempotency] Caught duplicate webhook event from ${provider}: ${eventId}. Ignoring.`);
                return false; // DUPLICATE!
            }
            // If some other DB error occurs, we log it. We fail 'open' here to avoid blocking legitimate requests
            // during a transient DB issue, but this behavior can be tightened to 'closed' for strict financial systems.
            logger.error(`[Idempotency] Failed to lock webhook ${eventId}`, error);
            return true;
        }

        return true; // Successfully locked, it is a new event.
    } catch (err) {
        logger.error(`[Idempotency] Unexpected error checking ${eventId}`, err);
        return true;
    }
}
