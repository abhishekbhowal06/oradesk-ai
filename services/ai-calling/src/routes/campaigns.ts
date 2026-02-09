import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { twilioClient, TWILIO_PHONE_NUMBER } from '../lib/twilio';

const router = Router();

// Endpoint: POST /v1/campaigns/upload
// Body: { clinic_id: string, csv_content: string (name, phone) }
router.post('/upload', async (req, res) => {
    const { clinic_id, csv_content } = req.body;

    if (!clinic_id || !csv_content) {
        return res.status(400).json({ error: 'Missing clinic_id or csv_content' });
    }

    try {
        const lines = csv_content.split('\n');
        const results = {
            total: 0,
            succeeded: 0,
            failed: 0,
            skipped: 0
        };

        // Simple CSV Parser (Assumes: Name, Phone)
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || i === 0 && line.toLowerCase().includes('phone')) continue; // Skip header

            results.total++;
            const parts = line.split(',');
            const name = parts[0]?.trim();
            const phone = parts[1]?.trim();

            if (!phone) {
                results.failed++;
                continue;
            }

            // 1. Find Patient
            const { data: patient } = await supabase
                .from('patients')
                .select('id')
                .eq('clinic_id', clinic_id)
                .eq('phone', phone)
                .single();

            let patientId = patient?.id;

            // If not found, create implicit patient? For Pilot, NO. Safety first.
            if (!patientId) {
                logger.warn(`Campaign: Patient not found for ${phone}`);
                results.skipped++;
                continue;
            }

            // 2. Check Logic (Already active call?)
            const { data: activeCalls } = await supabase
                .from('ai_calls')
                .select('id')
                .eq('patient_id', patientId)
                .in('status', ['queued', 'calling', 'ringing', 'in-progress', 'answered']);

            if (activeCalls && activeCalls.length > 0) {
                results.skipped++;
                continue;
            }

            // 3. Create 'Recall' Call
            // We use direct DB insert here instead of calling HTTP route to save overhead
            const { data: callRecord, error } = await supabase
                .from('ai_calls')
                .insert({
                    clinic_id: clinic_id,
                    patient_id: patientId,
                    phone_number: phone,
                    call_type: 'recall',
                    status: 'queued',
                    model_version: 'gemini-1.5-pro'
                })
                .select()
                .single();

            if (error || !callRecord) {
                results.failed++;
                continue;
            }

            // 4. Trigger Twilio (Fire and forget, or wait?)
            // For campaigns, let's fire 
            const webhookUrl = `${process.env.SERVICE_URL}/v1/webhooks/twilio/voice?call_id=${callRecord.id}&type=recall`;

            // Getting clinic phone number might differ, but for now use Env
            try {
                await twilioClient.calls.create({
                    to: phone,
                    from: TWILIO_PHONE_NUMBER!,
                    url: webhookUrl,
                    statusCallback: `${process.env.SERVICE_URL}/v1/webhooks/twilio/status?call_id=${callRecord.id}`,
                    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'busy', 'failed', 'no-answer']
                });

                // Update status
                await supabase.from('ai_calls').update({ status: 'calling' }).eq('id', callRecord.id);
                results.succeeded++;

            } catch (e) {
                logger.error(`Campaign dial failed for ${phone}`, e);
                await supabase.from('ai_calls').update({ status: 'failed' }).eq('id', callRecord.id);
                results.failed++;
            }

            // Rate limit safety bubble (100ms)
            await new Promise(r => setTimeout(r, 100));
        }

        res.json({ success: true, report: results });

    } catch (e) {
        logger.error('Campaign upload failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
