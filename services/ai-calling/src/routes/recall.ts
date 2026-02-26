import { Router } from 'express';
import { logger } from '../lib/logging/structured-logger';
import { validateBody, validateQuery, RecallInitiateSchema, RecallCandidatesQuerySchema } from '../lib/validation';

const router = Router();

// GET /v1/recall/candidates
// SECURITY: Uses req.supabaseUser (RLS-respecting) and req.clinicId (trusted from middleware)
router.get('/candidates', validateQuery(RecallCandidatesQuerySchema), async (req, res) => {
  const clinicId = req.clinicId; // TRUSTED: from requireClinicAccess middleware
  const { limit = '50' } = req.query;

  if (!clinicId) {
    return res.status(400).json({ error: 'Missing clinic context' });
  }

  try {
    const { data, error } = await req.supabaseUser!
      .from('recall_candidates')
      .select('*')
      .eq('clinic_id', clinicId)
      .limit(parseInt(limit as string, 10));

    if (error) {
      logger.error('Failed to fetch recall candidates', { error: error.message });
      return res.status(500).json({ error: 'Database error' });
    }

    const totalPotentialRevenue = (data || []).reduce(
      (sum, p) => sum + (p.estimated_annual_value || 0),
      0,
    );

    res.json({
      candidates: data || [],
      total_count: (data || []).length,
      total_potential_revenue: totalPotentialRevenue,
    });
  } catch (e) {
    logger.error('Recall candidates endpoint failed', { error: (e as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /v1/recall/initiate - Initiate calls for selected candidates
// SECURITY: Uses req.supabaseUser and req.clinicId — no untrusted clinic_id from body
router.post('/initiate', validateBody(RecallInitiateSchema), async (req, res) => {
  const clinicId = req.clinicId; // TRUSTED: from requireClinicAccess middleware
  const { patient_ids } = req.body;

  if (!clinicId || !patient_ids || !Array.isArray(patient_ids)) {
    return res.status(400).json({ error: 'Missing clinic context or patient_ids array' });
  }

  const userClient = req.supabaseUser!;
  let queued = 0;
  let skipped = 0;

  for (const patientId of patient_ids) {
    try {
      // Check for existing active call
      const { data: existing } = await userClient
        .from('ai_calls')
        .select('id')
        .eq('patient_id', patientId)
        .in('status', ['initiated', 'ringing', 'answered'])
        .single();

      if (existing) {
        skipped++;
        continue;
      }

      // Queue AI Call
      await userClient.from('ai_calls').insert({
        clinic_id: clinicId,
        patient_id: patientId,
        call_type: 'recall',
        status: 'initiated',
        initiated_at: new Date().toISOString(),
      });

      queued++;
    } catch (e) {
      logger.error(`Failed to queue recall for patient ${patientId}`, { error: (e as Error).message });
      skipped++;
    }
  }

  res.json({
    queued,
    skipped,
    message: `Queued ${queued} recall calls. Skipped ${skipped} (already active or error).`,
  });
});

export default router;
