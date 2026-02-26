/**
 * Call Service
 *
 * Core service layer for call orchestration.
 * Extracts business logic from route handlers for testability and reuse.
 */

import { supabase } from './supabase';
import { twilioClient, TWILIO_PHONE_NUMBER } from './twilio';
import { logger } from './logging/structured-logger';
import { logCallInitiated, logQuotaExceeded } from './audit-logger';
import { twilioCircuitBreaker, CircuitOpenError } from './circuit-breaker';
import type { AISettings } from '../types';

// Error types for structured error handling
export class CallServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public httpStatus: number = 500,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'CallServiceError';
  }
}

export const CallErrorCodes = {
  PATIENT_NOT_FOUND: 'PATIENT_NOT_FOUND',
  APPOINTMENT_NOT_FOUND: 'APPOINTMENT_NOT_FOUND',
  CLINIC_NOT_FOUND: 'CLINIC_NOT_FOUND',
  NO_PHONE: 'NO_PHONE',
  CONSENT_REQUIRED: 'CONSENT_REQUIRED',
  AUTOMATION_PAUSED: 'AUTOMATION_PAUSED',
  CALL_TYPE_DISABLED: 'CALL_TYPE_DISABLED',
  DUPLICATE_CALL: 'DUPLICATE_CALL',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  SUBSCRIPTION_INACTIVE: 'SUBSCRIPTION_INACTIVE',
  TWILIO_ERROR: 'TWILIO_ERROR',
  CIRCUIT_OPEN: 'CIRCUIT_OPEN',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

// Tier limits configuration
const TIER_LIMITS: Record<string, number> = {
  free: 10,
  starter: 100,
  growth: 500,
  professional: 2000,
  enterprise: 10000,
};

export interface CallContext {
  patient: {
    id: string;
    firstName: string;
    phone: string;
    clinicId: string;
  };
  appointment?: {
    id: string;
    scheduledAt: string;
    procedureName: string;
  };
  clinic: {
    id: string;
    name: string;
    phone: string;
    automationPaused: boolean;
    aiSettings?: AISettings;
    subscriptionTier: string;
    subscriptionStatus: string;
  };
  callType: string;
}

export interface CallResult {
  success: boolean;
  callId: string;
  twilioSid: string;
}

/**
 * Check if patient has consent for automated contact
 */
export async function checkConsent(patientId: string): Promise<boolean> {
  const { data: consent, error } = await supabase
    .from('patient_consents')
    .select('granted, revoked_at')
    .eq('patient_id', patientId)
    .eq('consent_type', 'automated_contact')
    .single();

  if (error && error.code !== 'PGRST116') {
    logger.error('Consent check failed', { patientId, error: error.message });
  }

  return consent?.granted === true && consent?.revoked_at === null;
}

/**
 * Check clinic quota for current billing period
 */
export async function checkQuota(clinicId: string): Promise<{
  allowed: boolean;
  currentUsage: number;
  limit: number;
  reason?: string;
}> {
  const { data: clinic, error: clinicError } = await supabase
    .from('clinics')
    .select('subscription_tier, subscription_status')
    .eq('id', clinicId)
    .single();

  if (clinicError || !clinic) {
    return { allowed: false, currentUsage: 0, limit: 0, reason: 'Clinic not found' };
  }

  if (clinic.subscription_status !== 'active' && clinic.subscription_status !== 'trialing') {
    return { allowed: false, currentUsage: 0, limit: 0, reason: 'SUBSCRIPTION_INACTIVE' };
  }

  const tier = clinic.subscription_tier || 'free';
  const limit = TIER_LIMITS[tier] || TIER_LIMITS['free'];

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count, error: countError } = await supabase
    .from('ai_calls')
    .select('*', { count: 'exact', head: true })
    .eq('clinic_id', clinicId)
    .gte('created_at', startOfMonth.toISOString());

  if (countError) {
    logger.error('Quota count failed', { clinicId, error: countError.message });
    return { allowed: true, currentUsage: 0, limit };
  }

  const currentUsage = count || 0;
  return {
    allowed: currentUsage < limit,
    currentUsage,
    limit,
    reason: currentUsage >= limit ? 'QUOTA_EXCEEDED' : undefined,
  };
}

/**
 * Check for duplicate active calls
 */
export async function checkDuplicateCall(patientId: string): Promise<boolean> {
  const { data: activeCalls } = await supabase
    .from('ai_calls')
    .select('id')
    .eq('patient_id', patientId)
    .in('status', ['queued', 'calling', 'ringing', 'in-progress', 'answered']);

  return (activeCalls?.length || 0) > 0;
}

/**
 * Validate call context and run all safety checks
 */
export async function validateCallContext(context: CallContext): Promise<void> {
  // Check 1: Patient consent
  const hasConsent = await checkConsent(context.patient.id);
  if (!hasConsent) {
    throw new CallServiceError(
      'Patient has not consented to automated contact',
      CallErrorCodes.CONSENT_REQUIRED,
      403,
    );
  }

  // Check 2: Automation pause
  if (context.clinic.automationPaused) {
    throw new CallServiceError(
      'Automation is currently paused for this clinic',
      CallErrorCodes.AUTOMATION_PAUSED,
      403,
    );
  }

  // Check 3: Call type enabled
  const aiSettings = context.clinic.aiSettings;
  if (aiSettings) {
    if (context.callType === 'confirmation' && aiSettings.confirmation_calls_enabled === false) {
      throw new CallServiceError(
        'AI confirmation calls disabled',
        CallErrorCodes.CALL_TYPE_DISABLED,
        403,
      );
    }
    if (context.callType === 'recall' && aiSettings.recall_enabled !== true) {
      throw new CallServiceError(
        'AI recall calls disabled',
        CallErrorCodes.CALL_TYPE_DISABLED,
        403,
      );
    }
  }

  // Check 4: Quota
  const quotaCheck = await checkQuota(context.clinic.id);
  if (!quotaCheck.allowed) {
    await logQuotaExceeded(context.clinic.id, quotaCheck.currentUsage, quotaCheck.limit);

    if (quotaCheck.reason === 'SUBSCRIPTION_INACTIVE') {
      throw new CallServiceError(
        'Subscription is not active',
        CallErrorCodes.SUBSCRIPTION_INACTIVE,
        402,
      );
    }

    throw new CallServiceError('Monthly call limit exceeded', CallErrorCodes.QUOTA_EXCEEDED, 429, {
      current_usage: quotaCheck.currentUsage,
      limit: quotaCheck.limit,
    });
  }

  // Check 5: Duplicate call
  const isDuplicate = await checkDuplicateCall(context.patient.id);
  if (isDuplicate) {
    throw new CallServiceError(
      'Call already in progress for this patient',
      CallErrorCodes.DUPLICATE_CALL,
      409,
    );
  }
}

/**
 * Create call record in database
 */
export async function createCallRecord(context: CallContext): Promise<string> {
  const { data: callRecord, error } = await supabase
    .from('ai_calls')
    .insert({
      clinic_id: context.clinic.id,
      appointment_id: context.appointment?.id || null,
      patient_id: context.patient.id,
      phone_number: context.patient.phone,
      call_type: context.callType,
      status: 'queued',
      model_version: 'gemini-1.5-pro-hardened',
      processing_time_ms: 0,
    })
    .select('id')
    .single();

  if (error) {
    throw new CallServiceError('Failed to create call record', CallErrorCodes.DATABASE_ERROR, 500, {
      error: error.message,
    });
  }

  await logCallInitiated(context.clinic.id, callRecord.id, context.patient.id, context.callType);
  return callRecord.id;
}

/**
 * Initiate Twilio call with circuit breaker protection
 */
export async function initiateTwilioCall(callId: string, context: CallContext): Promise<string> {
  const { chaosMonkey } = require('./chaos-monkey');
  await chaosMonkey.handleChaos('twilio');

  const webhookUrl = `${process.env.SERVICE_URL}/v1/webhooks/twilio/voice?call_id=${callId}&type=${context.callType}`;
  const statusUrl = `${process.env.SERVICE_URL}/v1/webhooks/twilio/status?call_id=${callId}`;

  try {
    const call = await twilioCircuitBreaker.execute(async () => {
      return twilioClient.calls.create({
        to: context.patient.phone,
        from: context.clinic.phone || TWILIO_PHONE_NUMBER!,
        url: webhookUrl,
        statusCallback: statusUrl,
        statusCallbackEvent: [
          'initiated',
          'ringing',
          'answered',
          'completed',
          'busy',
          'failed',
          'no-answer',
        ],
        timeout: 60,
      });
    });

    // Update call record
    await supabase
      .from('ai_calls')
      .update({
        external_call_id: call.sid,
        status: 'calling',
        call_started_at: new Date().toISOString(),
      })
      .eq('id', callId);

    return call.sid;
  } catch (error) {
    // Mark call as failed
    await supabase
      .from('ai_calls')
      .update({
        status: 'failed',
        escalation_reason:
          error instanceof CircuitOpenError
            ? 'Service temporarily unavailable'
            : `Twilio error: ${(error as Error).message}`,
      })
      .eq('id', callId);

    if (error instanceof CircuitOpenError) {
      throw new CallServiceError(
        'Call service temporarily unavailable',
        CallErrorCodes.CIRCUIT_OPEN,
        503,
      );
    }

    throw new CallServiceError('Failed to initiate call', CallErrorCodes.TWILIO_ERROR, 502, {
      error: (error as Error).message,
    });
  }
}

/**
 * Main orchestration: Execute outbound call with all safety checks
 */
export async function executeOutboundCall(context: CallContext): Promise<CallResult> {
  // Run all validations
  await validateCallContext(context);

  // Create call record
  const callId = await createCallRecord(context);

  // Initiate Twilio call
  const twilioSid = await initiateTwilioCall(callId, context);

  logger.info('Outbound call initiated', {
    callId,
    twilioSid,
    patientId: context.patient.id,
    callType: context.callType,
  });

  return {
    success: true,
    callId,
    twilioSid,
  };
}
