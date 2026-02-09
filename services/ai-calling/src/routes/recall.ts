import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// GET /v1/recall/candidates?clinic_id=...&limit=50
router.get('/candidates', async (req, res) => {
    const { clinic_id, limit = 50 } = req.query;

    if (!clinic_id) {
        return res.status(400).json({ error: 'Missing clinic_id' });
    }

    try {
        const { data, error } = await supabase
            .from('recall_candidates')
            .select('*')
            .eq('clinic_id', clinic_id)
            .limit(parseInt(limit as string, 10));

        if (error) {
            logger.error('Failed to fetch recall candidates', error);
            return res.status(500).json({ error: 'Database error' });
        }

        // Calculate total potential revenue
        const totalPotentialRevenue = (data || []).reduce((sum, p) => sum + (p.estimated_annual_value || 0), 0);

        res.json({
            candidates: data || [],
            total_count: (data || []).length,
            total_potential_revenue: totalPotentialRevenue
        });
    } catch (e) {
        logger.error('Recall candidates endpoint failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /v1/recall/initiate - Initiate calls for selected candidates
router.post('/initiate', async (req, res) => {
    const { clinic_id, patient_ids, assistant_id } = req.body;

    if (!clinic_id || !patient_ids || !Array.isArray(patient_ids)) {
        return res.status(400).json({ error: 'Missing clinic_id or patient_ids array' });
    }

    // For now, we queue them via the campaigns endpoint logic
    // In production, this would trigger Vapi calls

    let queued = 0;
    let skipped = 0;

    for (const patientId of patient_ids) {
        try {
            // Check for existing active call
            const { data: existing } = await supabase
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
            await supabase.from('ai_calls').insert({
                clinic_id,
                patient_id: patientId,
                call_type: 'recall',
                status: 'initiated',
                initiated_at: new Date().toISOString()
            });

            queued++;
        } catch (e) {
            logger.error(`Failed to queue recall for patient ${patientId}`, e);
            skipped++;
        }
    }

    res.json({
        queued,
        skipped,
        message: `Queued ${queued} recall calls. Skipped ${skipped} (already active or error).`
    });
});

export default router;
