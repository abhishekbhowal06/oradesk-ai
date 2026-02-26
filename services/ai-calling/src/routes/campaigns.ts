import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logging/structured-logger';
import { queueJob } from '../lib/job-queue';
import { CAMPAIGN_JOB_NAME } from '../services/CampaignWorker';

const router = Router();

// Endpoint: POST /v1/campaigns/upload
// Body: { csv_content: string (name, phone) }
// Note: clinic_id is now derived from authenticated user context (middleware)
router.post('/upload', async (req, res) => {
  const { csv_content } = req.body;
  // TRUSTED SOURCE: Middleware validated this
  const clinic_id = req.clinicId;

  if (!clinic_id || !csv_content) {
    return res.status(400).json({ error: 'Missing clinic_id context or csv_content' });
  }

  try {
    const results = {
      total: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
    };

    // Streaming CSV Parser to avoid memory spikes on large payloads
    const { Readable } = require('stream');
    const readline = require('readline');

    const stream = Readable.from([csv_content]);
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity,
    });

    let isFirstLine = true;

    for await (const line of rl) {
      if (!line.trim()) continue;

      if (isFirstLine && line.toLowerCase().includes('phone')) {
        isFirstLine = false;
        continue; // Skip header
      }
      isFirstLine = false;

      results.total++;
      const parts = line.split(',');
      const phone = parts[1]?.trim();

      if (!phone) {
        results.failed++;
        continue;
      }

      // 1. Find Patient
      // SECURITY: Query constrained to authorized clinic_id
      const { data: patient } = await req.supabaseUser!
        .from('patients')
        .select('id')
        .eq('clinic_id', clinic_id)
        .eq('phone', phone)
        .single();

      const patientId = patient?.id;

      if (!patientId) {
        logger.warn(`Campaign: Patient not found for ${phone} in clinic ${clinic_id}`);
        results.skipped++;
        continue;
      }

      // 2. Check Logic (Already active call?)
      const { data: activeCalls } = await req.supabaseUser!
        .from('ai_calls')
        .select('id')
        .eq('patient_id', patientId)
        .in('status', ['queued', 'calling', 'ringing', 'in-progress', 'answered']);

      if (activeCalls && activeCalls.length > 0) {
        results.skipped++;
        continue;
      }

      // 3. Create 'Recall' Call
      const { data: callRecord, error } = await req.supabaseUser!
        .from('ai_calls')
        .insert({
          clinic_id: clinic_id,
          patient_id: patientId,
          phone_number: phone,
          call_type: 'recall',
          status: 'queued',
          model_version: 'gemini-1.5-pro',
        })
        .select()
        .single();

      if (error || !callRecord) {
        results.failed++;
        continue;
      }

      // 4. Queue Job (Safe & Scalable)
      try {
        await queueJob(CAMPAIGN_JOB_NAME, {
          clinicId: clinic_id,
          patientId: patientId,
          phone,
          callType: 'recall',
          triggeredAt: new Date().toISOString(),
        });
        results.succeeded++;
      } catch (err) {
        logger.error(`Failed to queue job for ${phone}`, err);
        // JUSTIFICATION: Error recovery needs admin to mark failed regardless of RLS
        await supabaseAdmin.from('ai_calls').update({ status: 'failed' }).eq('id', callRecord.id);
        results.failed++;
      }
    }

    res.json({ success: true, report: results });
  } catch (e) {
    logger.error('Campaign upload failed', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
