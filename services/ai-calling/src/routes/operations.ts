/**
 * OPERATIONS HEALTH ROUTES
 *
 * Endpoints for system monitoring, staff alerts, and operational health.
 * These are clinic-understandable, not technical debugging endpoints.
 */

import { Router } from 'express';
import {
  runFailureDetection,
  runAutoRecovery,
  generateClinicHealth,
  getStaffAlerts,
  handleEscalation,
  getIncidentPlaybook,
} from '../lib/operations-reliability';
import { generateBridgeHealthReport, runBridgeHealthScan } from '../lib/bridge-health-monitor';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logging/structured-logger';

const router = Router();

/**
 * GET /v1/ops/health/:clinicId
 *
 * Returns clinic-understandable health signals
 * NOT technical metrics - operational meaning
 */
router.get('/health/:clinicId', async (req, res) => {
  const clinicId = req.clinicId; // TRUSTED: from requireClinicAccess middleware

  if (!clinicId) {
    return res.status(400).json({ error: 'Missing clinic context' });
  }

  try {
    const health = await generateClinicHealth(clinicId);

    // Convert to staff-friendly response
    const response = {
      status: health.overallHealth,
      generatedAt: health.generatedAt,
      summary:
        health.overallHealth === 'healthy'
          ? 'Everything is running smoothly'
          : health.overallHealth === 'needs_attention'
            ? 'Some items need your attention'
            : 'Immediate action required',
      signals: health.signals.map((s) => ({
        name: s.humanMessage,
        status: s.status,
        action: s.actionNeeded || null,
      })),
    };

    res.json(response);
  } catch (error) {
    logger.error('Health check failed', { clinicId, error: (error as Error).message });
    res.status(500).json({ error: 'Health check failed' });
  }
});

/**
 * GET /v1/ops/alerts/:clinicId
 *
 * Returns pending alerts/tasks for staff dashboard
 * These are actions staff need to take
 */
router.get('/alerts/:clinicId', async (req, res) => {
  const clinicId = req.clinicId; // TRUSTED

  if (!clinicId) {
    return res.status(400).json({ error: 'Missing clinic context' });
  }

  try {
    const alerts = await getStaffAlerts(clinicId);

    // Group by urgency
    const urgent = alerts.filter((a) => a.type === 'urgent_followup');
    const callbacks = alerts.filter((a) => a.type === 'patient_callback');
    const reviews = alerts.filter((a) => a.type === 'review_ai_decision');

    res.json({
      totalPending: alerts.length,
      urgent: urgent.length,
      alerts: {
        urgent,
        callbacks,
        reviews,
      },
    });
  } catch (error) {
    logger.error('Alerts fetch failed', { clinicId, error: (error as Error).message });
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

/**
 * POST /v1/ops/alerts/:alertId/handle
 *
 * Staff marks an escalation/alert as handled
 */
router.post('/alerts/:alertId/handle', async (req, res) => {
  const { alertId } = req.params;
  const staffId = req.user?.sub; // TRUSTED
  const { resolution } = req.body;

  if (!staffId || !resolution) {
    return res.status(400).json({ error: 'staffId and resolution required' });
  }

  try {
    const success = await handleEscalation(alertId, staffId, resolution);

    if (success) {
      logger.info('Escalation handled', { alertId, staffId });
      res.json({ success: true, message: 'Alert marked as handled' });
    } else {
      res.status(500).json({ error: 'Failed to update alert' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to handle alert' });
  }
});

/**
 * POST /v1/ops/detect-and-recover
 *
 * Runs failure detection and auto-recovery
 * Called by cron job every 5 minutes
 */
router.post('/detect-and-recover', async (req, res) => {
  try {
    // 1. Detect failures
    const failures = await runFailureDetection();

    // 2. Attempt auto-recovery
    const recoveryActions = await runAutoRecovery(failures);

    // 3. Log results
    logger.info('Operations check completed', {
      failuresDetected: failures.length,
      recoveryActions: recoveryActions.length,
      successfulRecoveries: recoveryActions.filter((r) => r.result === 'success').length,
      deferredToHuman: recoveryActions.filter((r) => r.result === 'deferred_to_human').length,
    });

    res.json({
      success: true,
      failuresDetected: failures.length,
      recoveryActions: recoveryActions.length,
      details: {
        failures: failures.map((f) => ({
          type: f.type,
          severity: f.severity,
          entity: f.affectedEntity,
        })),
        recoveries: recoveryActions.map((r) => ({
          type: r.type,
          action: r.action,
          result: r.result,
        })),
      },
    });
  } catch (error) {
    logger.error('Ops check failed', { error: (error as Error).message });
    res.status(500).json({ error: 'Operations check failed' });
  }
});

/**
 * GET /v1/ops/system-status
 *
 * Overall system status for admin/ops view
 */
router.get('/system-status', async (req, res) => {
  try {
    // Check external dependencies
    const dependencies = {
      database: 'healthy',
      twilio: 'healthy',
      gemini: 'healthy',
    };

    // Simple DB check
    const { error: dbError } = await supabaseAdmin.from('clinics').select('id').limit(1);
    if (dbError) dependencies.database = 'degraded';

    // JUSTIFICATION: System-wide metrics require service_role (cross-tenant aggregate)
    const { count: totalCalls } = await supabaseAdmin
      .from('ai_calls')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    const { count: activeCalls } = await supabaseAdmin
      .from('ai_calls')
      .select('*', { count: 'exact', head: true })
      .in('status', ['queued', 'calling', 'ringing', 'in-progress']);

    const { count: pendingEscalations } = await supabaseAdmin
      .from('ai_calls')
      .select('*', { count: 'exact', head: true })
      .eq('escalation_required', true)
      .is('escalation_handled_at', null);

    res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      dependencies,
      metrics: {
        callsLastHour: totalCalls || 0,
        activeCalls: activeCalls || 0,
        pendingEscalations: pendingEscalations || 0,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'degraded',
      error: 'System status check failed',
    });
  }
});

/**
 * GET /v1/ops/playbook/:scenario
 *
 * Returns incident playbook for specific scenarios
 * Used by staff to know what to do during incidents
 */
router.get('/playbook/:scenario', (req, res) => {
  const { scenario } = req.params;
  const playbook = getIncidentPlaybook(scenario);

  if (!playbook) {
    return res.status(404).json({
      error: 'Scenario not found',
      availableScenarios: [
        'twilio_down',
        'database_slow',
        'clinic_closes_early',
        'receptionist_ignores_dashboard',
        'patient_angry',
      ],
    });
  }

  res.json(playbook);
});

/**
 * GET /v1/ops/bridge-health/:clinicId
 *
 * Returns comprehensive bridge health report for a clinic.
 * Includes heartbeat freshness, sync lag, write queue health, and alerts.
 */
router.get('/bridge-health/:clinicId', async (req, res) => {
  const { clinicId } = req.params;

  try {
    const report = await generateBridgeHealthReport(clinicId);
    res.json(report);
  } catch (error) {
    logger.error('Bridge health check failed', { clinicId, error: (error as Error).message });
    res.status(500).json({ error: 'Bridge health check failed' });
  }
});

/**
 * POST /v1/ops/bridge-health-scan
 *
 * Scans ALL clinics with active bridges.
 * Called by cron every 2 minutes.
 */
router.post('/bridge-health-scan', async (req, res) => {
  try {
    const result = await runBridgeHealthScan();
    logger.info('Bridge health scan completed', result);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Bridge health scan failed', { error: (error as Error).message });
    res.status(500).json({ error: 'Bridge health scan failed' });
  }
});

/**
 * DELETE /v1/ops/data-deletion/:patientId
 * 
 * GDPR/CCPA Right to be Forgotten.
 * Anonymizes patient PII while preserving billing/analytics integrity.
 */
router.delete('/data-deletion/:patientId', async (req, res) => {
  const clinicId = req.clinicId;
  const { patientId } = req.params;

  if (!clinicId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // 1. Verify patient belongs to clinic
    const { data: patient, error: fetchError } = await supabaseAdmin
      .from('patients')
      .select('id')
      .eq('id', patientId)
      .eq('clinic_id', clinicId)
      .single();

    if (fetchError || !patient) {
      return res.status(404).json({ error: 'Patient not found or unauthorized' });
    }

    // 2. Anonymize patient record (keeping ID, replacing PII)
    const { error: updateError } = await supabaseAdmin
      .from('patients')
      .update({
        first_name: '[REDACTED]',
        last_name: '[REDACTED]',
        phone: '+10000000000',
        dob: null,
      })
      .eq('id', patientId)
      .eq('clinic_id', clinicId);

    if (updateError) throw updateError;

    // 3. Log the deletion admin action
    const { logAdminAction } = require('../lib/audit');
    await logAdminAction({
      clinicId,
      actorId: req.user?.sub || 'system',
      action: 'patient.gdpr_delete',
      resource: 'patients',
      metadata: { patientId },
      ipAddress: req.ip
    });

    logger.info('Patient data anonymized for GDPR compliance', { clinicId, patientId });
    res.json({ success: true, message: 'Patient data successfully anonymized' });
  } catch (error) {
    logger.error('Data deletion failed', { clinicId, patientId, error: (error as Error).message });
    res.status(500).json({ error: 'Failed to process data deletion' });
  }
});

// v2 PUBLIC STATUS API
import { getStatusHtml } from '../lib/status-template';
import { getCircuitBreakerHealth } from '../lib/circuit-breaker';

router.get('/public-status', async (req, res) => {
  try {
    // 1. Check DB (Lightweight ping)
    const { error: dbError } = await supabaseAdmin.from('clinics').select('id').limit(1);

    const cbHealth = getCircuitBreakerHealth();

    const status = {
      twilio: cbHealth.twilio.state === 'closed',
      gemini: cbHealth.gemini.state === 'closed',
      database: !dbError,
      overallHealthy: cbHealth.allHealthy && !dbError
    };

    if (req.headers.accept?.includes('text/html')) {
      return res.send(getStatusHtml(status));
    }

    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve system status' });
  }
});

export default router;
