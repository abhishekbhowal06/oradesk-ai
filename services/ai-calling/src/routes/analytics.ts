import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

router.get('/revenue', async (req, res) => {
    const { clinic_id } = req.query;

    if (!clinic_id) {
        return res.status(400).json({ error: 'Missing clinic_id' });
    }

    try {
        const { data, error } = await supabase
            .from('revenue_dashboard')
            .select('*')
            .eq('clinic_id', clinic_id)
            .single();

        if (error) {
            logger.error('Failed to fetch revenue stats', error);
            // Fallback for empty state (new clinic)
            return res.json({
                clinic_id,
                total_calls_30d: 0,
                revenue_secured_30d: 0,
                projected_annual_value: 0
            });
        }

        res.json(data);
    } catch (e) {
        logger.error('Analytics endpoint failed', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
