import { Job, registerJobHandler, JobPayload } from '../lib/job-queue';
import { logger } from '../lib/logging/structured-logger';
import { twilioClient, TWILIO_PHONE_NUMBER } from '../lib/twilio';
import { supabase } from '../lib/supabase';
import { redisClient } from '../lib/redis';

export const CAMPAIGN_JOB_NAME = 'outbound-campaign-call';
const MAX_CONCURRENT_CALLS_PER_CLINIC = 5;

/**
 * Worker: Handles outbound campaign calls safely.
 * - Concurrency: Managed by pg-boss (default 5 concurrent jobs globally)
 * - Rate Limiting: Implicit via job processing speed
 * - Retries: Handled by pg-boss (3 retries default)
 */
export async function registerCampaignWorker() {
    logger.info('Registering Campaign Worker...');

    // Enforce 10 concurrent processing workers globally to allow high throughput, 
    // relying on Redis for per-clinic throttling.
    await registerJobHandler(CAMPAIGN_JOB_NAME as any, async (job: Job<JobPayload>) => {

        const { clinicId, patientId, phone, callType, campaignId } = job.data;
        const jobId = job.id;

        if (!clinicId || !patientId || !phone || !callType) {
            logger.error(`Invalid job payload for campaign call ${jobId}: Missing required fields`, { jobData: job.data });
            return;
        }

        // --- STRICT CONCURRENCY RATE LIMITING ---
        const rateLimitKey = `campaign_rate_limit:${clinicId}`;
        const activeCount = await redisClient.incr(rateLimitKey);

        if (activeCount === 1) {
            // Assume 3 minutes is max typical call duration
            await redisClient.expire(rateLimitKey, 180);
        }

        if (activeCount > MAX_CONCURRENT_CALLS_PER_CLINIC) {
            logger.warn(`Rate limit (max 5) reached for clinic ${clinicId}. Active: ${activeCount}. Deferring ${jobId}`);
            await redisClient.decr(rateLimitKey);
            // Throwing an error triggers pg-boss exponential backoff
            throw new Error(`Rate limit exceeded for clinic ${clinicId}`);
        }

        logger.info(`Processing campaign call job ${jobId}`, { patientId, phone });

        // 1. Double check: Is the call already completed/failed? (Idempotency)
        // We look for a recent call record created by this job?
        // Actually, the route creates the DB record first, then queues the job.
        // So we should receive the callRecordId in the payload ideally.
        // But the current payload design (from plan) only has clinicId/patientId.
        // Let's look up the "queued" call for this patient.

        const { data: callRecord, error: searchError } = await supabase
            .from('ai_calls')
            .select('id, status')
            .eq('clinic_id', clinicId)
            .eq('patient_id', patientId)
            .eq('status', 'queued') // Only pick up queued calls
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

        if (searchError || !callRecord) {
            logger.warn(`No queued call found for job ${jobId} - skipping (maybe already processed?)`, { patientId });
            return;
        }

        // 2. Initiate Twilio Call
        const webhookUrl = `${process.env.SERVICE_URL}/v1/webhooks/twilio/voice?call_id=${callRecord.id}&type=${callType}`;
        const statusCallback = `${process.env.SERVICE_URL}/v1/webhooks/twilio/status?call_id=${callRecord.id}`;
        const fromNumber = TWILIO_PHONE_NUMBER!;

        try {
            logger.info(`Dialing ${phone} for call ${callRecord.id}...`);

            const call = await twilioClient.calls.create({
                to: phone,
                from: fromNumber,
                url: webhookUrl,
                statusCallback,
                statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'busy', 'failed', 'no-answer'],
                // Custom params for tracking
                timeout: 30, // Ring for 30s max
            });

            // 3. Update DB to 'calling'
            await supabase
                .from('ai_calls')
                .update({
                    status: 'calling',
                    external_call_id: call.sid
                })
                .eq('id', callRecord.id);

            logger.info(`Campaign call initiated: ${call.sid}`);

        } catch (error) {
            logger.error(`Twilio dial failed for job ${jobId}`, { error });

            // Mark as failed in DB so we don't retry forever without visibility
            await supabase
                .from('ai_calls')
                .update({
                    status: 'failed',
                    metadata: { failure_reason: (error as Error).message }
                })
                .eq('id', callRecord.id);

            // Free token since Twilio failed to dial
            await redisClient.decr(rateLimitKey);
            throw error; // Let pg-boss handle retry logic (exponential backoff)
        }
    }, { teamSize: 10, teamConcurrency: 10 });
}
