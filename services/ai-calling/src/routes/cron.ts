import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { twilioClient, TWILIO_PHONE_NUMBER } from '../lib/twilio';

const router = Router();

// Triggered by Cloud Scheduler every 5-15 mins
router.post('/process-followups', async (req, res) => {
    try {
        const now = new Date().toISOString();

        // 1. Find pending follow-ups that are due
        const { data: followups, error } = await supabase
            .from('follow_up_schedules')
            .select('*, appointments(*), patients(phone), clinics(ai_settings)')
            .eq('status', 'pending')
            .lte('scheduled_for', now)
            .limit(20); // Batch size

        if (error) throw error;
        if (!followups || followups.length === 0) {
            return res.json({ message: 'No follow-ups due' });
        }

        const results = [];

        for (const item of followups) {
            // 2. Check if we reached max attempts
            if (item.attempt_number >= item.max_attempts) {
                await supabase
                    .from('follow_up_schedules')
                    .update({ status: 'exhausted' })
                    .eq('id', item.id);
                continue;
            }

            // 3. Initiate Call (Reuse outbound logic or call it directly)
            const patientPhone = item.patients?.phone;
            const clinicAiSettings = item.clinics?.ai_settings as any;

            // Check if AI is paused for this specific clinic
            if (!clinicAiSettings || clinicAiSettings.follow_up_enabled === false) {
                continue; // Skip without erroring
            }

            if (!patientPhone) continue;

            logger.info(`Processing follow-up for ${item.id} -> ${patientPhone}`);

            // Create new AI Call record for this attempt
            const { data: newCall } = await supabase
                .from('ai_calls')
                .insert({
                    clinic_id: item.clinic_id,
                    appointment_id: item.appointment_id,
                    patient_id: item.patient_id,
                    phone_number: patientPhone,
                    call_type: 'follow_up',
                    status: 'queued'
                })
                .select()
                .single();

            if (!newCall) continue;

            // Trigger Twilio
            const webhookUrl = `${process.env.SERVICE_URL}/v1/webhooks/twilio/voice?call_id=${newCall.id}&type=follow_up`;
            await twilioClient.calls.create({
                to: patientPhone,
                from: TWILIO_PHONE_NUMBER!,
                url: webhookUrl,
                statusCallback: `${process.env.SERVICE_URL}/v1/webhooks/twilio/status?call_id=${newCall.id}`,
                statusCallbackEvent: ['completed', 'failed', 'busy', 'no-answer']
            });

            // 4. Update Schedule (Increment attempt)
            await supabase
                .from('follow_up_schedules')
                .update({
                    attempt_number: item.attempt_number + 1,
                    last_attempt_at: now,
                    related_call_id: newCall.id,
                    // Simple backoff: next attempt in N hours
                    next_attempt_at: new Date(Date.now() + (item.delay_hours * 3600000)).toISOString()
                })
                .eq('id', item.id);

            results.push(item.id);
        }

        res.json({ processed: results.length, ids: results });

    } catch (error) {
        logger.error('Cron job failed', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
