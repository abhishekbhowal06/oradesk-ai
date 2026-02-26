import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { twilioClient, TWILIO_PHONE_NUMBER } from '../lib/twilio';
import { logger } from '../lib/logging/structured-logger';
import { logCallInitiated, logQuotaExceeded } from '../lib/audit-logger';
import { billingService } from '../services/data/BillingService';
import { patientService } from '../services/data/PatientService';
import { traceStorage } from '../lib/logging/context';
import type { Appointment, Patient, Clinic, AISettings } from '../types';

const router = Router();

// Error codes for structured error handling
const ERROR_CODES = {
  MISSING_PARAMS: 'MISSING_PARAMS',
  NOT_FOUND: 'NOT_FOUND',
  NO_PHONE: 'NO_PHONE',
  CONSENT_REQUIRED: 'CONSENT_REQUIRED',
  AUTOMATION_PAUSED: 'AUTOMATION_PAUSED',
  CALL_TYPE_DISABLED: 'CALL_TYPE_DISABLED',
  DUPLICATE_CALL: 'DUPLICATE_CALL',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  SUBSCRIPTION_INACTIVE: 'SUBSCRIPTION_INACTIVE',
  TWILIO_ERROR: 'TWILIO_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const;

router.post('/outbound', async (req, res) => {
  const { appointment_id, patient_id, call_type = 'confirmation' } = req.body;

  // TRUSTED SOURCE: Middleware validated this
  const authorizedClinicId = req.clinicId;

  if (!authorizedClinicId) {
    return res.status(403).json({ error: 'Missing authorized clinic context' });
  }

  // Validation
  if (!appointment_id && !patient_id) {
    return res.status(400).json({
      error: 'Must provide either appointment_id or patient_id',
      code: ERROR_CODES.MISSING_PARAMS,
    });
  }

  try {
    let appointment: Appointment | null = null;
    let patient: Patient | null = null;
    let clinic: Clinic | null = null;
    let fetchedClinicId = authorizedClinicId;

    // Path A: Has Appointment (Confirmation)
    if (appointment_id) {
      // SECURITY: Ensure checking against authorizedClinicId
      const { data: app, error: appError } = await req.supabaseUser!
        .from('appointments')
        .select(`*, patients (*), clinics (*)`)
        .eq('id', appointment_id)
        .eq('clinic_id', authorizedClinicId) // IDOR PROTECTION
        .single();

      if (appError || !app) {
        // Return generic 404 to avoid leaking existence
        return res
          .status(404)
          .json({ error: 'Appointment not found', code: ERROR_CODES.NOT_FOUND });
      }
      appointment = app;
      patient = app.patients;
      clinic = app.clinics;
      fetchedClinicId = app.clinic_id;
    }
    // Path B: Has Patient (Recall)
    else if (patient_id) {
      // SECURITY: Ensure checking against authorizedClinicId
      const { data: pat, error: patError } = await req.supabaseUser!
        .from('patients')
        .select(`*, clinics (*)`)
        .eq('id', patient_id)
        .eq('clinic_id', authorizedClinicId) // IDOR PROTECTION
        .single();

      if (patError || !pat) {
        return res.status(404).json({ error: 'Patient not found', code: ERROR_CODES.NOT_FOUND });
      }
      patient = pat;
      clinic = pat.clinics;
      fetchedClinicId = pat.clinic_id;
    }

    // Guard: patient and clinic must be resolved by one of the paths above
    if (!patient || !clinic) {
      return res.status(404).json({ error: 'Patient or clinic not found', code: ERROR_CODES.NOT_FOUND });
    }

    const patientPhone = patient.phone;
    const clinicPhone = clinic.twilio_phone_number || TWILIO_PHONE_NUMBER;

    if (!patientPhone) {
      return res
        .status(400)
        .json({ error: 'Patient has no phone number', code: ERROR_CODES.NO_PHONE });
    }

    // ============================================================
    // SAFETY CHECK 1: Patient Consent (TCPA/HIPAA Compliance)
    // ============================================================
    const consentCheck = await patientService.checkPatientConsent(patient.id);
    if (!consentCheck.hasConsent) {
      logger.warn('Call blocked: No patient consent', {
        patientId: patient.id,
        callType: call_type,
      });
      return res.status(403).json({
        error: 'Patient has not consented to automated contact',
        code: ERROR_CODES.CONSENT_REQUIRED,
      });
    }

    // ============================================================
    // SAFETY CHECK 2: Automation Pause (Staff Override)
    // ============================================================
    if (clinic?.automation_paused === true) {
      logger.info('Call blocked: Automation paused for clinic', { clinicId: fetchedClinicId });
      return res.status(403).json({
        error: 'Automation is currently paused for this clinic',
        code: ERROR_CODES.AUTOMATION_PAUSED,
      });
    }

    // ============================================================
    // SAFETY CHECK 3: Call Type Enabled
    // ============================================================
    const aiSettings = clinic?.ai_settings as AISettings | undefined;
    if (aiSettings) {
      if (call_type === 'confirmation' && aiSettings.confirmation_calls_enabled === false) {
        return res.status(403).json({
          error: 'AI confirmation calls disabled',
          code: ERROR_CODES.CALL_TYPE_DISABLED,
        });
      }
      if (call_type === 'recall' && aiSettings.recall_enabled !== true) {
        return res.status(403).json({
          error: 'AI recall calls disabled',
          code: ERROR_CODES.CALL_TYPE_DISABLED,
        });
      }
    }

    // ============================================================
    // SAFETY CHECK 4: Billing Quota Enforcement
    // ============================================================
    const quotaCheck = await billingService.checkClinicQuota(fetchedClinicId);
    if (!quotaCheck.allowed) {
      await logQuotaExceeded(fetchedClinicId, quotaCheck.currentUsage, quotaCheck.limit);

      if (quotaCheck.reason === 'SUBSCRIPTION_INACTIVE') {
        return res.status(402).json({
          error: 'Subscription is not active',
          code: ERROR_CODES.SUBSCRIPTION_INACTIVE,
        });
      }

      logger.warn('Call blocked: Quota exceeded', {
        clinicId: fetchedClinicId,
        usage: quotaCheck.currentUsage,
        limit: quotaCheck.limit,
      });
      return res.status(429).json({
        error: 'Monthly call limit exceeded',
        code: ERROR_CODES.QUOTA_EXCEEDED,
        current_usage: quotaCheck.currentUsage,
        limit: quotaCheck.limit,
      });
    }

    // ============================================================
    // SAFETY CHECK 5: Duplicate Call Prevention
    // ============================================================
    const { data: activeCalls } = await req.supabaseUser!
      .from('ai_calls')
      .select('id')
      .eq('patient_id', patient.id)
      .in('status', ['queued', 'calling', 'ringing', 'in-progress', 'answered']);

    if (activeCalls && activeCalls.length > 0) {
      logger.warn('Call blocked: Duplicate call attempt', { patientId: patient.id });
      return res.status(409).json({
        error: 'Call already in progress for this patient',
        code: ERROR_CODES.DUPLICATE_CALL,
      });
    }

    // ============================================================
    // CREATE CALL RECORD
    // ============================================================
    const { data: callRecord, error: callError } = await req.supabaseUser!
      .from('ai_calls')
      .insert({
        clinic_id: fetchedClinicId,
        appointment_id: appointment?.id || null,
        patient_id: patient.id,
        phone_number: patientPhone,
        call_type: call_type,
        status: 'queued',
        model_version: 'gemini-1.5-pro-hardened',
        processing_time_ms: 0,
      })
      .select()
      .single();

    if (callError) {
      logger.error('Failed to create call record', { error: callError.message });
      return res.status(500).json({ error: 'Database error', code: ERROR_CODES.DATABASE_ERROR });
    }

    // Inject callId into trace context for subsequent logs
    const store = traceStorage.getStore();
    if (store) {
      store.callId = callRecord.id;
      store.clinicId = fetchedClinicId;
    }

    // Log to immutable audit log
    await logCallInitiated(fetchedClinicId, callRecord.id, patient.id, call_type);

    // ============================================================
    // INITIATE TWILIO CALL
    // ============================================================
    const webhookUrl = `${process.env.SERVICE_URL}/v1/webhooks/twilio/voice?call_id=${callRecord.id}&type=${call_type}`;

    let call;
    try {
      call = await twilioClient.calls.create({
        to: patientPhone,
        from: clinicPhone!,
        url: webhookUrl,
        statusCallback: `${process.env.SERVICE_URL}/v1/webhooks/twilio/status?call_id=${callRecord.id}`,
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
    } catch (twilioErr) {
      logger.error('Twilio call initiation failed', { error: (twilioErr as Error).message });
      await req.supabaseUser!
        .from('ai_calls')
        .update({
          status: 'failed',
          escalation_reason: 'Twilio API Error: ' + (twilioErr as Error).message,
        })
        .eq('id', callRecord.id);

      return res.status(502).json({
        error: 'Failed to initiate call',
        code: ERROR_CODES.TWILIO_ERROR,
      });
    }

    // Update call record with Twilio SID
    await req.supabaseUser!
      .from('ai_calls')
      .update({
        external_call_id: call.sid,
        status: 'calling',
        call_started_at: new Date().toISOString(),
      })
      .eq('id', callRecord.id);

    logger.info('Outbound call initiated successfully', {
      callId: callRecord.id,
      twilioSid: call.sid,
      patientId: patient.id,
      callType: call_type,
    });

    return res.status(201).json({
      success: true,
      call_id: callRecord.id,
      twilio_sid: call.sid,
    });
  } catch (error) {
    logger.error('Outbound call failed', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
