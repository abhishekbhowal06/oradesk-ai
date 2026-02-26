import { Router } from 'express';
import { logger } from '../lib/logging/structured-logger';
import { createUserScopedReadClient } from '../lib/supabase';

const router = Router();

// ─── /revenue endpoint ───────────────────────────────
// SECURITY: Uses read-replica (RLS-respecting) and req.clinicId (trusted from middleware)
router.get('/revenue', async (req, res) => {
  const clinicId = req.clinicId;
  const userJwt = req.headers.authorization?.split(' ')[1];

  if (!clinicId || !userJwt) {
    return res.status(400).json({ error: 'Missing clinic context or authentication' });
  }

  try {
    const readClient = createUserScopedReadClient(userJwt);
    const { data, error } = await readClient
      .from('revenue_dashboard')
      .select('*')
      .eq('clinic_id', clinicId)
      .single();

    if (error) {
      logger.error('Failed to fetch revenue stats', { error: error.message });
      return res.json({
        clinic_id: clinicId,
        total_calls_30d: 0,
        revenue_secured_30d: 0,
        projected_annual_value: 0,
      });
    }

    res.json(data);
  } catch (e) {
    logger.error('Analytics endpoint failed', { error: (e as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── /roi — Real clinic ROI metrics for Dashboard ────────
router.get('/roi', async (req, res) => {
  const clinicId = req.clinicId; // TRUSTED: from requireClinicAccess middleware

  if (!clinicId) {
    return res.status(400).json({ error: 'Missing clinic context' });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const userJwt = req.headers.authorization?.split(' ')[1];

  if (!userJwt) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const readClient = createUserScopedReadClient(userJwt);

  try {
    // Run all queries in parallel for speed on the READ REPLICA
    const [
      callsResult,
      appointmentsResult,
      missedResult,
      tasksResult,
      revenueResult,
    ] = await Promise.all([
      // 1. AI Calls in last 30 days
      readClient
        .from('ai_calls')
        .select('id, status, outcome, duration_seconds, revenue_impact', { count: 'exact' })
        .eq('clinic_id', clinicId)
        .gte('created_at', thirtyDaysAgo),

      // 2. AI-managed appointments confirmed/rescheduled in last 30 days
      readClient
        .from('appointments')
        .select('id, status', { count: 'exact' })
        .eq('clinic_id', clinicId)
        .eq('ai_managed', true)
        .in('status', ['confirmed', 'rescheduled', 'completed'])
        .gte('created_at', thirtyDaysAgo),

      // 3. Missed appointments (no-shows) in last 30 days
      readClient
        .from('appointments')
        .select('id', { count: 'exact' })
        .eq('clinic_id', clinicId)
        .eq('status', 'missed')
        .gte('created_at', thirtyDaysAgo),

      // 4. Pending staff tasks (escalations needing attention)
      readClient
        .from('staff_tasks')
        .select('id', { count: 'exact' })
        .eq('clinic_id', clinicId)
        .in('status', ['pending', 'in_progress']),

      // 5. Revenue attribution totals
      readClient
        .from('revenue_attribution')
        .select('estimated_value, actual_value, status')
        .eq('clinic_id', clinicId)
        .gte('created_at', thirtyDaysAgo),
    ]);

    // ── Process call metrics ──────────────────────────────────
    const calls = (callsResult.data || []) as any[];
    const totalCalls = callsResult.count || 0;
    const completedCalls = calls.filter((c: any) => c.status === 'completed').length;
    const answeredCalls = calls.filter((c: any) => ['answered', 'completed'].includes(c.status)).length;
    const callSuccessRate = totalCalls > 0 ? Math.round((answeredCalls / totalCalls) * 100) : 0;

    // Revenue from calls
    const totalRevenueImpact = calls.reduce((sum: number, c: any) => sum + (Number(c.revenue_impact) || 0), 0);

    // Total call time in minutes
    const totalCallMinutes = Math.round(
      calls.reduce((sum: number, c: any) => sum + (c.duration_seconds || 0), 0) / 60
    );

    // ── Appointments ──────────────────────────────────────────
    const appointmentsBooked = appointmentsResult.count || 0;
    const missedAppointments = missedResult.count || 0;

    // ── Staff tasks ───────────────────────────────────────────
    const pendingTasks = tasksResult.count || 0;

    // ── Revenue attribution ───────────────────────────────────
    const revenueData = (revenueResult.data || []) as any[];
    const estimatedRevenue = revenueData.reduce(
      (sum: number, r: any) => sum + (Number(r.estimated_value) || 0), 0
    );
    const confirmedRevenue = revenueData
      .filter((r: any) => ['confirmed', 'completed'].includes(r.status))
      .reduce((sum: number, r: any) => sum + (Number(r.actual_value) || Number(r.estimated_value) || 0), 0);

    // ── Calculate derived metrics ─────────────────────────────
    const staffHoursSaved = Math.round((totalCalls * 3) / 60 * 10) / 10;

    const recoveredNoShows = calls.filter(
      (c: any) => c.outcome === 'confirmed' && totalCalls > 0
    ).length;

    const roiMetrics = {
      totalCalls30d: totalCalls,
      completedCalls30d: completedCalls,
      callSuccessRate,
      totalCallMinutes,
      appointmentsBooked30d: appointmentsBooked,
      missedAppointments30d: missedAppointments,
      recoveredNoShows,
      estimatedRevenue30d: Math.round(estimatedRevenue * 100) / 100,
      confirmedRevenue30d: Math.round(confirmedRevenue * 100) / 100,
      revenueImpact30d: Math.round(totalRevenueImpact * 100) / 100,
      pendingTasks,
      staffHoursSaved,
      clinicId,
      periodStart: thirtyDaysAgo,
      periodEnd: new Date().toISOString(),
      generatedAt: new Date().toISOString(),
    };

    res.json(roiMetrics);
  } catch (e) {
    logger.error('ROI analytics endpoint failed', { error: (e as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
