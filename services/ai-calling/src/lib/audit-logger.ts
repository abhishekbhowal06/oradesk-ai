/**
 * Audit Logger Service
 *
 * Provides HIPAA-compliant immutable audit logging for all system actions.
 * Logs are written to the audit_log table which has no UPDATE/DELETE policies.
 */

import { supabase } from './supabase';
import { logger } from './logging/structured-logger';

export type AuditEventType =
  | 'call.initiated'
  | 'call.completed'
  | 'call.failed'
  | 'call.emergency_escalation'
  | 'appointment.created'
  | 'appointment.updated'
  | 'appointment.confirmed'
  | 'appointment.cancelled'
  | 'patient.created'
  | 'patient.updated'
  | 'patient.deleted'
  | 'consent.granted'
  | 'consent.revoked'
  | 'auth.login'
  | 'auth.logout'
  | 'billing.quota_exceeded'
  | 'billing.plan_changed'
  | 'billing.subscription_cancelled'
  | 'automation.paused'
  | 'automation.resumed'
  | 'admin.staff_invited'
  | 'admin.staff_removed'
  | 'admin.staff_role_changed'
  | 'admin.settings_changed'
  | 'admin.data_export'
  | 'admin.data_deletion'
  | 'admin.calendar_connected'
  | 'admin.calendar_disconnected'
  | 'admin.bridge_activated'
  | 'admin.bridge_disconnected'
  | 'system.error';

export type ActorType = 'user' | 'system' | 'ai';

export type AuditAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'call_initiated'
  | 'call_completed'
  | 'emergency_escalation'
  | 'consent_granted'
  | 'consent_revoked'
  | 'login'
  | 'logout';

export interface AuditLogEntry {
  clinicId?: string;
  eventType: AuditEventType;
  actorId?: string;
  actorType: ActorType;
  resourceType: string;
  resourceId?: string;
  action: AuditAction;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an audit event to the immutable audit log
 */
export async function logAuditEvent(entry: AuditLogEntry): Promise<void> {
  try {
    const { error } = await supabase.from('audit_log').insert({
      clinic_id: entry.clinicId,
      event_type: entry.eventType,
      actor_id: entry.actorId,
      actor_type: entry.actorType,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      action: entry.action,
      details: entry.details,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
    });

    if (error) {
      // Log to Winston but don't throw - audit should not break main flow
      logger.error('Failed to write audit log', { error: error.message, entry });
    }
  } catch (err) {
    logger.error('Audit log exception', { error: (err as Error).message, entry });
  }
}

/**
 * Log a call initiation event
 */
export async function logCallInitiated(
  clinicId: string,
  callId: string,
  patientId: string,
  callType: string,
): Promise<void> {
  await logAuditEvent({
    clinicId,
    eventType: 'call.initiated',
    actorType: 'system',
    resourceType: 'ai_call',
    resourceId: callId,
    action: 'call_initiated',
    details: { patient_id: patientId, call_type: callType },
  });
}

/**
 * Log an emergency escalation event
 */
export async function logEmergencyEscalation(
  clinicId: string,
  callId: string,
  patientId: string,
  reason: string,
  detectedPhrase: string,
): Promise<void> {
  await logAuditEvent({
    clinicId,
    eventType: 'call.emergency_escalation',
    actorType: 'ai',
    resourceType: 'ai_call',
    resourceId: callId,
    action: 'emergency_escalation',
    details: {
      patient_id: patientId,
      escalation_reason: reason,
      detected_phrase: detectedPhrase,
    },
  });
}

/**
 * Log a quota exceeded event
 */
export async function logQuotaExceeded(
  clinicId: string,
  currentUsage: number,
  limit: number,
): Promise<void> {
  await logAuditEvent({
    clinicId,
    eventType: 'billing.quota_exceeded',
    actorType: 'system',
    resourceType: 'clinic',
    resourceId: clinicId,
    action: 'read',
    details: { current_usage: currentUsage, limit },
  });
}

/**
 * Log consent granted/revoked
 */
export async function logConsentChange(
  clinicId: string,
  patientId: string,
  consentType: string,
  granted: boolean,
  actorId?: string,
): Promise<void> {
  await logAuditEvent({
    clinicId,
    eventType: granted ? 'consent.granted' : 'consent.revoked',
    actorId,
    actorType: actorId ? 'user' : 'system',
    resourceType: 'patient_consent',
    resourceId: patientId,
    action: granted ? 'consent_granted' : 'consent_revoked',
    details: { consent_type: consentType },
  });
}

/**
 * Log an admin action (staff management, settings, etc.)
 */
export async function logAdminAction(
  clinicId: string,
  userId: string,
  eventType: AuditEventType,
  resourceType: string,
  resourceId: string,
  details: Record<string, unknown>,
  req?: { ip?: string; headers?: Record<string, unknown> },
): Promise<void> {
  await logAuditEvent({
    clinicId,
    eventType,
    actorId: userId,
    actorType: 'user',
    resourceType,
    resourceId,
    action: 'update',
    details,
    ipAddress: req?.ip,
    userAgent: req?.headers?.['user-agent'] as string | undefined,
  });
}

/**
 * Log a data deletion event (GDPR compliance)
 */
export async function logDataDeletion(
  clinicId: string,
  userId: string,
  resourceType: string,
  resourceId: string,
  deletedFields: string[],
): Promise<void> {
  await logAuditEvent({
    clinicId,
    eventType: 'admin.data_deletion',
    actorId: userId,
    actorType: 'user',
    resourceType,
    resourceId,
    action: 'delete',
    details: { deleted_fields: deletedFields, deletion_type: 'gdpr_request' },
  });
}

/**
 * Log a staff membership change
 */
export async function logStaffChange(
  clinicId: string,
  actorId: string,
  eventType: 'admin.staff_invited' | 'admin.staff_removed' | 'admin.staff_role_changed',
  targetUserId: string,
  details: Record<string, unknown>,
): Promise<void> {
  await logAuditEvent({
    clinicId,
    eventType,
    actorId,
    actorType: 'user',
    resourceType: 'staff_membership',
    resourceId: targetUserId,
    action: eventType === 'admin.staff_removed' ? 'delete' : 'update',
    details,
  });
}
