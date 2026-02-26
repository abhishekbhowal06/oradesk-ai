import { Router } from 'express';
import { logger } from '../lib/logging/structured-logger';
import { logAuditEvent } from '../lib/audit-logger';

const router = Router();

/**
 * POST /v1/automation/pause
 * Pause all automation for a clinic
 * SECURITY: Uses req.supabaseUser (RLS-respecting) and req.clinicId (trusted from middleware)
 */
router.post('/pause', async (req, res) => {
  const clinicId = req.clinicId; // TRUSTED: from requireClinicAccess middleware
  const userId = req.user?.sub;  // TRUSTED: from requireAuth middleware
  const { reason } = req.body;

  if (!clinicId) {
    return res.status(400).json({ error: 'Missing clinic context' });
  }

  try {
    const { error } = await req.supabaseUser!
      .from('clinics')
      .update({
        automation_paused: true,
        automation_paused_at: new Date().toISOString(),
        automation_paused_by: userId || null,
      })
      .eq('id', clinicId);

    if (error) {
      logger.error('Failed to pause automation', { clinicId, error: error.message });
      return res.status(500).json({ error: 'Failed to pause automation' });
    }

    // Log to immutable audit log
    await logAuditEvent({
      clinicId,
      eventType: 'automation.paused',
      actorId: userId,
      actorType: userId ? 'user' : 'system',
      resourceType: 'clinic',
      resourceId: clinicId,
      action: 'update',
      details: { reason: reason || 'Manual pause requested' },
    });

    logger.info('Automation paused', { clinicId, userId });

    return res.json({
      success: true,
      message: 'Automation paused for clinic',
      paused_at: new Date().toISOString(),
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
  const clinicId = req.clinicId; // TRUSTED
  const userId = req.user?.sub;  // TRUSTED

  if (!clinicId) {
    return res.status(400).json({ error: 'Missing clinic context' });
  }

  try {
    const { error } = await req.supabaseUser!
      .from('clinics')
      .update({
        automation_paused: false,
        automation_paused_at: null,
        automation_paused_by: null,
      })
      .eq('id', clinicId);

    if (error) {
      logger.error('Failed to resume automation', { clinicId, error: error.message });
      return res.status(500).json({ error: 'Failed to resume automation' });
    }

    await logAuditEvent({
      clinicId,
      eventType: 'automation.resumed',
      actorId: userId,
      actorType: userId ? 'user' : 'system',
      resourceType: 'clinic',
      resourceId: clinicId,
      action: 'update',
      details: {},
    });

    logger.info('Automation resumed', { clinicId, userId });

    return res.json({
      success: true,
      message: 'Automation resumed for clinic',
    });
  } catch (error) {
    logger.error('Resume automation failed', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /v1/automation/status
 * Get automation status for the authenticated user's clinic
 * CHANGED: No longer accepts clinic_id from URL params (IDOR risk)
 */
router.get('/status', async (req, res) => {
  const clinicId = req.clinicId; // TRUSTED

  if (!clinicId) {
    return res.status(400).json({ error: 'Missing clinic context' });
  }

  try {
    const { data: clinic, error } = await req.supabaseUser!
      .from('clinics')
      .select('automation_paused, automation_paused_at, automation_paused_by, ai_settings')
      .eq('id', clinicId)
      .single();

    if (error || !clinic) {
      return res.status(404).json({ error: 'Clinic not found' });
    }

    return res.json({
      clinic_id: clinicId,
      automation_paused: clinic.automation_paused || false,
      paused_at: clinic.automation_paused_at,
      paused_by: clinic.automation_paused_by,
      ai_settings: clinic.ai_settings,
    });
  } catch (error) {
    logger.error('Get automation status failed', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
