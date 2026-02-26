/**
 * OPERATIONS RELIABILITY MODULE
 *
 * Production Operations Engineering for Dentacore OS
 * Ensures system survives real-world usage without engineer intervention.
 */

import { supabase } from './supabase';
import { logger } from './logging/structured-logger';

// =========================================================================
// PHASE 1: SILENT FAILURE DETECTION
// =========================================================================

export interface OperationalFailure {
  type: FailureType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: Date;
  affectedEntity: { type: string; id: string };
  description: string;
  suggestedRecovery: string;
  staffAction?: string;
}

export type FailureType =
  | 'call_stuck_in_queue'
  | 'call_loop_retry'
  | 'calendar_updated_staff_unaware'
  | 'escalation_unhandled'
  | 'consent_revoked_still_scheduled'
  | 'automation_paused_jobs_running'
  | 'patient_unreachable_no_followup'
  | 'staff_task_stale'
  | 'sync_stale'
  | 'circuit_breaker_open';

// Failure detection thresholds
const THRESHOLDS = {
  CALL_STUCK_MINUTES: 15,
  ESCALATION_UNHANDLED_HOURS: 4,
  STAFF_TASK_STALE_HOURS: 24,
  SYNC_STALE_HOURS: 2,
  RETRY_LOOP_MAX: 5,
  UNREACHABLE_WITHOUT_FOLLOWUP_HOURS: 8,
};

/**
 * Detect calls stuck in 'queued' or 'calling' state too long
 */
export async function detectStuckCalls(): Promise<OperationalFailure[]> {
  const stuckThreshold = new Date(Date.now() - THRESHOLDS.CALL_STUCK_MINUTES * 60 * 1000);

  const { data: stuckCalls } = await supabase
    .from('ai_calls')
    .select('id, clinic_id, patient_id, status, created_at')
    .in('status', ['queued', 'calling', 'ringing'])
    .lt('created_at', stuckThreshold.toISOString());

  if (!stuckCalls || stuckCalls.length === 0) return [];

  return stuckCalls.map((call) => ({
    type: 'call_stuck_in_queue' as FailureType,
    severity: 'high' as const,
    detectedAt: new Date(),
    affectedEntity: { type: 'ai_call', id: call.id },
    description: `Call ${call.id} stuck in ${call.status} for over ${THRESHOLDS.CALL_STUCK_MINUTES} minutes`,
    suggestedRecovery: 'Mark as failed and create staff task',
    staffAction: 'Call patient manually - automated call failed to connect',
  }));
}

/**
 * Detect escalations that haven't been handled
 */
export async function detectUnhandledEscalations(): Promise<OperationalFailure[]> {
  const threshold = new Date(Date.now() - THRESHOLDS.ESCALATION_UNHANDLED_HOURS * 60 * 60 * 1000);

  const { data: unhandled } = await supabase
    .from('ai_calls')
    .select('id, clinic_id, patient_id, escalation_reason, created_at')
    .eq('escalation_required', true)
    .is('escalation_handled_at', null)
    .lt('created_at', threshold.toISOString());

  if (!unhandled || unhandled.length === 0) return [];

  return unhandled.map((call) => ({
    type: 'escalation_unhandled' as FailureType,
    severity: 'critical' as const,
    detectedAt: new Date(),
    affectedEntity: { type: 'ai_call', id: call.id },
    description: `Escalation unhandled for ${THRESHOLDS.ESCALATION_UNHANDLED_HOURS}+ hours: ${call.escalation_reason}`,
    suggestedRecovery: 'Alert clinic dashboard immediately',
    staffAction: 'Review AI escalation and contact patient if needed',
  }));
}

/**
 * Detect consent revoked but appointments still scheduled
 */
export async function detectConsentConflicts(): Promise<OperationalFailure[]> {
  const { data: conflicts } = await supabase.rpc('find_consent_conflicts');

  // Fallback if RPC not available
  if (!conflicts) {
    const { data: revokedConsents } = await supabase
      .from('patient_consents')
      .select('patient_id')
      .eq('consent_type', 'automated_contact')
      .not('revoked_at', 'is', null);

    if (!revokedConsents || revokedConsents.length === 0) return [];

    const patientIds = revokedConsents.map((c) => c.patient_id);

    const { data: futureAppts } = await supabase
      .from('appointments')
      .select('id, patient_id, scheduled_at')
      .in('patient_id', patientIds)
      .eq('status', 'scheduled')
      .gte('scheduled_at', new Date().toISOString());

    if (!futureAppts || futureAppts.length === 0) return [];

    return futureAppts.map((appt) => ({
      type: 'consent_revoked_still_scheduled' as FailureType,
      severity: 'high' as const,
      detectedAt: new Date(),
      affectedEntity: { type: 'appointment', id: appt.id },
      description: `Appointment ${appt.id} scheduled but patient revoked consent`,
      suggestedRecovery: 'Mark appointment for manual confirmation only',
      staffAction: 'Contact patient manually - they opted out of AI calls',
    }));
  }

  return [];
}

/**
 * Detect automation paused but queued jobs still running
 */
export async function detectPausedAutomationLeaks(): Promise<OperationalFailure[]> {
  const { data: pausedClinics } = await supabase
    .from('clinics')
    .select('id, name')
    .eq('automation_paused', true);

  if (!pausedClinics || pausedClinics.length === 0) return [];

  const pausedIds = pausedClinics.map((c) => c.id);

  const { data: leakedCalls } = await supabase
    .from('ai_calls')
    .select('id, clinic_id, status, created_at')
    .in('clinic_id', pausedIds)
    .in('status', ['queued', 'calling', 'ringing'])
    .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString());

  if (!leakedCalls || leakedCalls.length === 0) return [];

  return leakedCalls.map((call) => ({
    type: 'automation_paused_jobs_running' as FailureType,
    severity: 'high' as const,
    detectedAt: new Date(),
    affectedEntity: { type: 'ai_call', id: call.id },
    description: `Call ${call.id} running despite automation being paused`,
    suggestedRecovery: 'Cancel call immediately',
    staffAction: 'Check pause status - call may have started before pause',
  }));
}

/**
 * Master failure detection - runs all checks
 */
export async function runFailureDetection(): Promise<OperationalFailure[]> {
  const failures: OperationalFailure[] = [];

  try {
    failures.push(...(await detectStuckCalls()));
    failures.push(...(await detectUnhandledEscalations()));
    failures.push(...(await detectConsentConflicts()));
    failures.push(...(await detectPausedAutomationLeaks()));
  } catch (error) {
    logger.error('Failure detection error', { error: (error as Error).message });
  }

  // Log each failure
  for (const failure of failures) {
    logger.warn('Operational failure detected', {
      type: failure.type,
      severity: failure.severity,
      entity: failure.affectedEntity,
      description: failure.description,
    });
  }

  return failures;
}

// =========================================================================
// PHASE 2: OBSERVABILITY LAYER - Clinic-Understandable Signals
// =========================================================================

export interface ClinicHealthSignal {
  signal: string;
  value: number;
  status: 'healthy' | 'warning' | 'critical';
  humanMessage: string;
  actionNeeded?: string;
}

export interface ClinicHealthReport {
  clinicId: string;
  generatedAt: Date;
  overallHealth: 'healthy' | 'needs_attention' | 'critical';
  signals: ClinicHealthSignal[];
}

/**
 * Generate clinic-understandable health report
 */
export async function generateClinicHealth(clinicId: string): Promise<ClinicHealthReport> {
  const signals: ClinicHealthSignal[] = [];
  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 1. Call Success Rate
  const { data: recentCalls } = await supabase
    .from('ai_calls')
    .select('id, outcome, status')
    .eq('clinic_id', clinicId)
    .gte('created_at', last24h.toISOString());

  if (recentCalls && recentCalls.length > 0) {
    const successful = recentCalls.filter(
      (c) => c.outcome === 'confirmed' || c.outcome === 'rescheduled',
    ).length;
    const successRate = Math.round((successful / recentCalls.length) * 100);

    signals.push({
      signal: 'call_success_rate',
      value: successRate,
      status: successRate >= 70 ? 'healthy' : successRate >= 50 ? 'warning' : 'critical',
      humanMessage:
        successRate >= 70
          ? 'Patients are responding well'
          : successRate >= 50
            ? 'Some patients not answering'
            : 'Most patients not answering calls',
      actionNeeded: successRate < 50 ? 'Check if calling at wrong times' : undefined,
    });

    // 2. Unreachable Rate
    const unreachable = recentCalls.filter(
      (c) => c.status === 'no_answer' || c.outcome === 'unreachable',
    ).length;
    const unreachableRate = Math.round((unreachable / recentCalls.length) * 100);

    if (unreachableRate > 30) {
      signals.push({
        signal: 'unreachable_rate',
        value: unreachableRate,
        status: unreachableRate > 50 ? 'critical' : 'warning',
        humanMessage: `${unreachableRate}% of patients didn't answer`,
        actionNeeded: 'Consider different calling times or SMS fallback',
      });
    }
  }

  // 3. Escalation Backlog
  const { count: escalationBacklog } = await supabase
    .from('ai_calls')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('escalation_required', true)
    .is('escalation_handled_at', null);

  signals.push({
    signal: 'escalation_backlog',
    value: escalationBacklog || 0,
    status:
      (escalationBacklog || 0) === 0
        ? 'healthy'
        : (escalationBacklog || 0) <= 3
          ? 'warning'
          : 'critical',
    humanMessage:
      (escalationBacklog || 0) === 0
        ? 'No pending patient follow-ups'
        : `${escalationBacklog} patients need staff attention`,
    actionNeeded: (escalationBacklog || 0) > 0 ? 'Review pending escalations' : undefined,
  });

  // 4. Staff Task Backlog
  const { count: taskBacklog } = await supabase
    .from('staff_tasks')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .eq('status', 'pending');

  if ((taskBacklog || 0) > 5) {
    signals.push({
      signal: 'staff_overload',
      value: taskBacklog || 0,
      status: (taskBacklog || 0) > 10 ? 'critical' : 'warning',
      humanMessage: 'Front desk may be overloaded',
      actionNeeded: 'Clear pending tasks or add staff support',
    });
  }

  // 5. Automation Effectiveness
  const { data: weekCalls } = await supabase
    .from('ai_calls')
    .select('id, outcome')
    .eq('clinic_id', clinicId)
    .gte('created_at', last7d.toISOString());

  if (weekCalls && weekCalls.length > 0) {
    const confirmed = weekCalls.filter((c) => c.outcome === 'confirmed').length;
    const effectivenessRate = Math.round((confirmed / weekCalls.length) * 100);

    signals.push({
      signal: 'automation_effectiveness',
      value: effectivenessRate,
      status:
        effectivenessRate >= 60 ? 'healthy' : effectivenessRate >= 40 ? 'warning' : 'critical',
      humanMessage:
        effectivenessRate >= 60
          ? 'AI is confirming appointments effectively'
          : 'AI confirmation rate is low',
      actionNeeded:
        effectivenessRate < 40 ? 'Review AI settings or consider manual confirmation' : undefined,
    });
  }

  // Determine overall health
  const criticalCount = signals.filter((s) => s.status === 'critical').length;
  const warningCount = signals.filter((s) => s.status === 'warning').length;

  const overallHealth =
    criticalCount > 0 ? 'critical' : warningCount > 2 ? 'needs_attention' : 'healthy';

  return {
    clinicId,
    generatedAt: now,
    overallHealth,
    signals,
  };
}

// =========================================================================
// PHASE 3: SELF RECOVERY LOGIC
// =========================================================================

export interface RecoveryAction {
  type: string;
  entityId: string;
  action: string;
  result: 'success' | 'failed' | 'deferred_to_human';
  details?: string;
}

/**
 * Auto-recover stuck calls
 */
async function recoverStuckCall(callId: string): Promise<RecoveryAction> {
  // Mark as failed and create staff task
  const { error } = await supabase
    .from('ai_calls')
    .update({
      status: 'failed',
      outcome: 'unreachable',
      escalation_required: true,
      escalation_reason: 'Auto-recovered: Call stuck in queue',
    })
    .eq('id', callId);

  if (error) {
    return { type: 'stuck_call', entityId: callId, action: 'mark_failed', result: 'failed' };
  }

  // Create staff task
  const { data: call } = await supabase
    .from('ai_calls')
    .select('clinic_id, patient_id')
    .eq('id', callId)
    .single();

  if (call) {
    await supabase.from('staff_tasks').insert({
      clinic_id: call.clinic_id,
      title: 'Automated call failed - manual follow-up needed',
      description: `Call ${callId} failed to connect. Please contact patient manually.`,
      priority: 'high',
      status: 'pending',
      related_patient_id: call.patient_id,
    });
  }

  return {
    type: 'stuck_call',
    entityId: callId,
    action: 'mark_failed_and_create_task',
    result: 'success',
  };
}

/**
 * Cancel calls for paused clinics
 */
async function cancelPausedClinicCalls(clinicId: string): Promise<RecoveryAction[]> {
  const { data: activeCalls } = await supabase
    .from('ai_calls')
    .select('id, external_call_id')
    .eq('clinic_id', clinicId)
    .in('status', ['queued', 'calling', 'ringing']);

  if (!activeCalls || activeCalls.length === 0) {
    return [];
  }

  const results: RecoveryAction[] = [];

  for (const call of activeCalls) {
    await supabase
      .from('ai_calls')
      .update({
        status: 'cancelled',
        escalation_reason: 'Cancelled: Automation was paused',
      })
      .eq('id', call.id);

    results.push({
      type: 'paused_clinic_call',
      entityId: call.id,
      action: 'cancel',
      result: 'success',
    });
  }

  return results;
}

/**
 * Run automatic recovery for detected failures
 */
export async function runAutoRecovery(failures: OperationalFailure[]): Promise<RecoveryAction[]> {
  const recoveryActions: RecoveryAction[] = [];

  for (const failure of failures) {
    try {
      switch (failure.type) {
        case 'call_stuck_in_queue':
          const stuckResult = await recoverStuckCall(failure.affectedEntity.id);
          recoveryActions.push(stuckResult);
          break;

        case 'automation_paused_jobs_running':
          // Get clinic ID from call
          const { data: call } = await supabase
            .from('ai_calls')
            .select('clinic_id')
            .eq('id', failure.affectedEntity.id)
            .single();
          if (call) {
            const pausedResults = await cancelPausedClinicCalls(call.clinic_id);
            recoveryActions.push(...pausedResults);
          }
          break;

        case 'escalation_unhandled':
          // Create urgent staff task
          await supabase.from('staff_tasks').insert({
            clinic_id: failure.affectedEntity.id,
            title: 'URGENT: Unhandled AI escalation',
            description: failure.description,
            priority: 'urgent',
            status: 'pending',
          });
          recoveryActions.push({
            type: 'escalation_unhandled',
            entityId: failure.affectedEntity.id,
            action: 'create_urgent_task',
            result: 'deferred_to_human',
          });
          break;

        default:
          // Defer to human
          logger.info('Failure type requires human intervention', { type: failure.type });
          recoveryActions.push({
            type: failure.type,
            entityId: failure.affectedEntity.id,
            action: 'defer_to_human',
            result: 'deferred_to_human',
            details: failure.staffAction,
          });
      }
    } catch (error) {
      logger.error('Auto-recovery failed', {
        failure: failure.type,
        entity: failure.affectedEntity,
        error: (error as Error).message,
      });
    }
  }

  return recoveryActions;
}

// =========================================================================
// PHASE 4: HUMAN INTERVENTION DESIGN - Staff Dashboard Data
// =========================================================================

export interface StaffAlert {
  id: string;
  type: 'patient_callback' | 'review_ai_decision' | 'update_settings' | 'urgent_followup';
  title: string;
  description: string;
  patientName?: string;
  patientPhone?: string;
  createdAt: Date;
  actions: StaffAction[];
}

export interface StaffAction {
  label: string;
  actionType: 'call' | 'dismiss' | 'reschedule' | 'mark_handled' | 'open_details';
  primary: boolean;
}

/**
 * Get pending alerts for staff dashboard
 */
export async function getStaffAlerts(clinicId: string): Promise<StaffAlert[]> {
  const alerts: StaffAlert[] = [];

  // 1. Unhandled escalations
  const { data: escalations } = await supabase
    .from('ai_calls')
    .select(
      `
            id, 
            escalation_reason, 
            created_at,
            patients(first_name, last_name, phone)
        `,
    )
    .eq('clinic_id', clinicId)
    .eq('escalation_required', true)
    .is('escalation_handled_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  if (escalations) {
    for (const esc of escalations) {
      const patient = esc.patients as any;
      alerts.push({
        id: esc.id,
        type: 'patient_callback',
        title: 'Patient needs callback',
        description: esc.escalation_reason || 'AI could not complete interaction',
        patientName: patient ? `${patient.first_name} ${patient.last_name}` : undefined,
        patientPhone: patient?.phone,
        createdAt: new Date(esc.created_at),
        actions: [
          { label: 'Call Patient', actionType: 'call', primary: true },
          { label: 'Mark Handled', actionType: 'mark_handled', primary: false },
          { label: 'View Details', actionType: 'open_details', primary: false },
        ],
      });
    }
  }

  // 2. Pending staff tasks
  const { data: tasks } = await supabase
    .from('staff_tasks')
    .select('id, title, description, priority, created_at')
    .eq('clinic_id', clinicId)
    .eq('status', 'pending')
    .order('priority', { ascending: true })
    .limit(10);

  if (tasks) {
    for (const task of tasks) {
      alerts.push({
        id: task.id,
        type: task.priority === 'urgent' ? 'urgent_followup' : 'review_ai_decision',
        title: task.title,
        description: task.description,
        createdAt: new Date(task.created_at),
        actions: [
          { label: 'Complete Task', actionType: 'mark_handled', primary: true },
          { label: 'Dismiss', actionType: 'dismiss', primary: false },
        ],
      });
    }
  }

  return alerts;
}

/**
 * Mark escalation as handled by staff
 */
export async function handleEscalation(
  callId: string,
  staffId: string,
  resolution: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('ai_calls')
    .update({
      escalation_handled_at: new Date().toISOString(),
      escalation_handled_by: staffId,
      escalation_resolution: resolution,
    })
    .eq('id', callId);

  return !error;
}

// =========================================================================
// PHASE 5: INCIDENT SIMULATION HANDLERS
// =========================================================================

export interface IncidentScenario {
  name: string;
  systemResponse: string;
  clinicRecovery: string;
}

export const INCIDENT_PLAYBOOK: Record<string, IncidentScenario> = {
  twilio_down: {
    name: 'Twilio API Outage',
    systemResponse: `
            1. Circuit breaker opens after 3 failed calls
            2. All new calls rejected with "service unavailable"
            3. Alert appears on dashboard: "AI calling temporarily unavailable"
            4. Queued calls marked as "deferred"
            5. Periodic health check attempts recovery every 60s
        `,
    clinicRecovery: `
            STAFF ACTION:
            - Purple banner appears: "AI Calls Paused - Use Manual Calling"
            - Click "View Queue" to see pending patients
            - Call patients manually from the list
            - When banner turns green, AI resumes automatically
        `,
  },
  database_slow: {
    name: 'Database Latency Spike',
    systemResponse: `
            1. Requests timeout after 10s
            2. Calls in progress continue (Twilio handles voice)
            3. New calls rejected temporarily
            4. Health endpoint returns "degraded"
            5. Auto-retry with exponential backoff
        `,
    clinicRecovery: `
            STAFF ACTION:
            - Dashboard may load slowly
            - Wait 2-3 minutes and refresh
            - If persists, contact support
            - AI calls resume when healthy
        `,
  },
  clinic_closes_early: {
    name: 'Clinic Closes Early / Wrong Hours',
    systemResponse: `
            1. Calls continue until manually paused
            2. Patients reached say "office is closed"
            3. AI escalates these as "patient concern"
            4. Staff sees spike in escalations
        `,
    clinicRecovery: `
            STAFF ACTION:
            - Click "Pause AI Calls" immediately
            - Update business hours in Settings
            - Click "Resume" when hours are correct
            - Review escalations from bad-timing calls
        `,
  },
  receptionist_ignores_dashboard: {
    name: 'Staff Not Monitoring Dashboard',
    systemResponse: `
            1. Escalation backlog grows
            2. After 4 hours: email alert sent to clinic admin
            3. After 8 hours: SMS alert to clinic owner
            4. Dashboard shows red "X patients waiting" badge
            5. If unresolved 24h: automation auto-pauses
        `,
    clinicRecovery: `
            STAFF ACTION:
            - Check email/SMS alerts
            - Open dashboard and review pending items
            - Clear the backlog
            - Discuss with team about monitoring
        `,
  },
  patient_angry: {
    name: 'Patient Angry or Upset on Call',
    systemResponse: `
            1. Emergency phrases detected: "this is ridiculous", "I'm upset"
            2. AI immediately says: "I understand this is frustrating"
            3. AI escalates to human: "A staff member will call you right away"
            4. Call marked as HIGH PRIORITY escalation
            5. Alert appears at top of staff dashboard
        `,
    clinicRecovery: `
            STAFF ACTION:
            - RED ALERT appears: "Urgent: Upset patient"
            - Call patient within 15 minutes
            - Listen and apologize
            - Resolve their concern directly
            - Mark as handled with notes
        `,
  },
};

/**
 * Export for testing - simulate incident and get expected behavior
 */
export function getIncidentPlaybook(incidentType: string): IncidentScenario | undefined {
  return INCIDENT_PLAYBOOK[incidentType];
}
