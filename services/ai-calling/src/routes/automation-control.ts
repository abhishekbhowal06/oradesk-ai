import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { logAuditEvent } from '../lib/audit-logger';

const router = Router();

/**
 * POST /v1/automation/pause
 * Pause all automation for a clinic
 */
router.post('/pause', async (req, res) => {
    const { clinic_id, user_id, reason } = req.body;

    if (!clinic_id) {
        return res.status(400).json({ error: 'clinic_id is required' });
    }

    try {
        const { error } = await supabase
            .from('clinics')
            .update({
                automation_paused: true,
                automation_paused_at: new Date().toISOString(),
                automation_paused_by: user_id || null
            })
            .eq('id', clinic_id);

        if (error) {
            logger.error('Failed to pause automation', { clinicId: clinic_id, error: error.message });
            return res.status(500).json({ error: 'Failed to pause automation' });
        }

        // Log to immutable audit log
        await logAuditEvent({
            clinicId: clinic_id,
            eventType: 'automation.paused',
            actorId: user_id,
            actorType: user_id ? 'user' : 'system',
            resourceType: 'clinic',
            resourceId: clinic_id,
            action: 'update',
            details: { reason: reason || 'Manual pause requested' }
        });

        logger.info('Automation paused', { clinicId: clinic_id, userId: user_id });

        return res.json({
            success: true,
            message: 'Automation paused for clinic',
            paused_at: new Date().toISOString()
        });

    } catch (error) {
        logger.error('Pause automation failed', { error: (error as Error).message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /v1/automation/resume
 * Resume automation for a clinic
 */
router.post('/resume', async (req, res) => {
    const { clinic_id, user_id } = req.body;

    if (!clinic_id) {
        return res.status(400).json({ error: 'clinic_id is required' });
    }

    try {
        const { error } = await supabase
            .from('clinics')
            .update({
                automation_paused: false,
                automation_paused_at: null,
                automation_paused_by: null
            })
            .eq('id', clinic_id);

        if (error) {
            logger.error('Failed to resume automation', { clinicId: clinic_id, error: error.message });
            return res.status(500).json({ error: 'Failed to resume automation' });
        }

        // Log to immutable audit log
        await logAuditEvent({
            clinicId: clinic_id,
            eventType: 'automation.resumed',
            actorId: user_id,
            actorType: user_id ? 'user' : 'system',
            resourceType: 'clinic',
            resourceId: clinic_id,
            action: 'update',
            details: {}
        });

        logger.info('Automation resumed', { clinicId: clinic_id, userId: user_id });

        return res.json({
            success: true,
            message: 'Automation resumed for clinic'
        });

    } catch (error) {
        logger.error('Resume automation failed', { error: (error as Error).message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /v1/automation/status/:clinic_id
 * Get automation status for a clinic
 */
router.get('/status/:clinic_id', async (req, res) => {
    const { clinic_id } = req.params;

    try {
        const { data: clinic, error } = await supabase
            .from('clinics')
            .select('automation_paused, automation_paused_at, automation_paused_by, ai_settings')
            .eq('id', clinic_id)
            .single();

        if (error || !clinic) {
            return res.status(404).json({ error: 'Clinic not found' });
        }

        return res.json({
            clinic_id,
            automation_paused: clinic.automation_paused || false,
            paused_at: clinic.automation_paused_at,
            paused_by: clinic.automation_paused_by,
            ai_settings: clinic.ai_settings
        });

    } catch (error) {
        logger.error('Get automation status failed', { error: (error as Error).message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
