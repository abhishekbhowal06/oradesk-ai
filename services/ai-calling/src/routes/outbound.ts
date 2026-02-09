import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { twilioClient, TWILIO_PHONE_NUMBER } from '../lib/twilio';
import { logger } from '../lib/logger';
import { logCallInitiated, logQuotaExceeded } from '../lib/audit-logger';

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
    DATABASE_ERROR: 'DATABASE_ERROR'
} as const;

// Tier limits (should match billing configuration)
const TIER_LIMITS: Record<string, number> = {
    'free': 10,
    'starter': 100,
    'growth': 500,
    'enterprise': 10000
};

/**
 * Check if patient has granted consent for automated contact
 */
async function checkPatientConsent(patientId: string): Promise<{ hasConsent: boolean; error?: string }> {
    const { data: consent, error } = await supabase
        .from('patient_consents')
        .select('granted, revoked_at')
        .eq('patient_id', patientId)
        .eq('consent_type', 'automated_contact')
        .single();

    if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" - that's expected if no consent record
        logger.error('Consent check failed', { patientId, error: error.message });
    }

    // Consent must exist, be granted, and not revoked
    const hasConsent = consent?.granted === true && consent?.revoked_at === null;

    return { hasConsent };
}

/**
 * Check clinic quota for the current billing period
 */
async function checkClinicQuota(clinicId: string): Promise<{
    allowed: boolean;
    currentUsage: number;
    limit: number;
    reason?: string;
}> {
    // Get clinic subscription info
    const { data: clinic, error: clinicError } = await supabase
        .from('clinics')
        .select('subscription_tier, subscription_status')
        .eq('id', clinicId)
        .single();

    if (clinicError || !clinic) {
        return { allowed: false, currentUsage: 0, limit: 0, reason: 'Clinic not found' };
    }

    // Check subscription status
    if (clinic.subscription_status !== 'active' && clinic.subscription_status !== 'trialing') {
        return { allowed: false, currentUsage: 0, limit: 0, reason: 'SUBSCRIPTION_INACTIVE' };
    }

    // Get tier limit
    const tier = clinic.subscription_tier || 'free';
    const limit = TIER_LIMITS[tier] || TIER_LIMITS['free'];

    // Count calls this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count, error: countError } = await supabase
        .from('ai_calls')
        .select('*', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .gte('created_at', startOfMonth.toISOString());

    if (countError) {
        logger.error('Failed to count calls', { clinicId, error: countError.message });
        // Fail open for now - but log it
        return { allowed: true, currentUsage: 0, limit };
    }

    const currentUsage = count || 0;
    const allowed = currentUsage < limit;

    return { allowed, currentUsage, limit, reason: allowed ? undefined : 'QUOTA_EXCEEDED' };
}

router.post('/outbound', async (req, res) => {
    const { appointment_id, patient_id, call_type = 'confirmation', clinic_id } = req.body;

    // Validation
    if (!appointment_id && !patient_id) {
        return res.status(400).json({
            error: 'Must provide either appointment_id or patient_id',
            code: ERROR_CODES.MISSING_PARAMS
        });
    }

    try {
        let appointment: any = null;
        let patient: any = null;
        let clinic: any = null;
        let fetchedClinicId = clinic_id;

        // Path A: Has Appointment (Confirmation)
        if (appointment_id) {
            const { data: app, error: appError } = await supabase
                .from('appointments')
                .select(`*, patients (*), clinics (*)`)
                .eq('id', appointment_id)
                .single();

            if (appError || !app) {
                return res.status(404).json({ error: 'Appointment not found', code: ERROR_CODES.NOT_FOUND });
            }
            appointment = app;
            patient = app.patients;
            clinic = app.clinics;
            fetchedClinicId = app.clinic_id;
        }
        // Path B: Has Patient (Recall)
        else if (patient_id) {
            const { data: pat, error: patError } = await supabase
                .from('patients')
                .select(`*, clinics (*)`)
                .eq('id', patient_id)
                .single();

            if (patError || !pat) {
                return res.status(404).json({ error: 'Patient not found', code: ERROR_CODES.NOT_FOUND });
            }
            patient = pat;
            clinic = pat.clinics;
            fetchedClinicId = pat.clinic_id;
        }

        const patientPhone = patient?.phone;
        const clinicPhone = clinic?.twilio_phone_number || TWILIO_PHONE_NUMBER;

        if (!patientPhone) {
            return res.status(400).json({ error: 'Patient has no phone number', code: ERROR_CODES.NO_PHONE });
        }

        // ============================================================
        // SAFETY CHECK 1: Patient Consent (TCPA/HIPAA Compliance)
        // ============================================================
        const consentCheck = await checkPatientConsent(patient.id);
        if (!consentCheck.hasConsent) {
            logger.warn('Call blocked: No patient consent', { patientId: patient.id, callType: call_type });
            return res.status(403).json({
                error: 'Patient has not consented to automated contact',
                code: ERROR_CODES.CONSENT_REQUIRED
            });
        }

        // ============================================================
        // SAFETY CHECK 2: Automation Pause (Staff Override)
        // ============================================================
        if (clinic?.automation_paused === true) {
            logger.info('Call blocked: Automation paused for clinic', { clinicId: fetchedClinicId });
            return res.status(403).json({
                error: 'Automation is currently paused for this clinic',
                code: ERROR_CODES.AUTOMATION_PAUSED
            });
        }

        // ============================================================
        // SAFETY CHECK 3: Call Type Enabled
        // ============================================================
        const aiSettings = clinic?.ai_settings as any;
        if (aiSettings) {
            if (call_type === 'confirmation' && aiSettings.confirmation_calls_enabled === false) {
                return res.status(403).json({
                    error: 'AI confirmation calls disabled',
                    code: ERROR_CODES.CALL_TYPE_DISABLED
                });
            }
            if (call_type === 'recall' && aiSettings.recall_enabled !== true) {
                return res.status(403).json({
                    error: 'AI recall calls disabled',
                    code: ERROR_CODES.CALL_TYPE_DISABLED
                });
            }
        }

        // ============================================================
        // SAFETY CHECK 4: Billing Quota Enforcement
        // ============================================================
        const quotaCheck = await checkClinicQuota(fetchedClinicId);
        if (!quotaCheck.allowed) {
            await logQuotaExceeded(fetchedClinicId, quotaCheck.currentUsage, quotaCheck.limit);

            if (quotaCheck.reason === 'SUBSCRIPTION_INACTIVE') {
                return res.status(402).json({
                    error: 'Subscription is not active',
                    code: ERROR_CODES.SUBSCRIPTION_INACTIVE
                });
            }

            logger.warn('Call blocked: Quota exceeded', {
                clinicId: fetchedClinicId,
                usage: quotaCheck.currentUsage,
                limit: quotaCheck.limit
            });
            return res.status(429).json({
                error: 'Monthly call limit exceeded',
                code: ERROR_CODES.QUOTA_EXCEEDED,
                current_usage: quotaCheck.currentUsage,
                limit: quotaCheck.limit
            });
        }

        // ============================================================
        // SAFETY CHECK 5: Duplicate Call Prevention
        // ============================================================
        const { data: activeCalls } = await supabase
            .from('ai_calls')
            .select('id')
            .eq('patient_id', patient.id)
            .in('status', ['queued', 'calling', 'ringing', 'in-progress', 'answered']);

        if (activeCalls && activeCalls.length > 0) {
            logger.warn('Call blocked: Duplicate call attempt', { patientId: patient.id });
            return res.status(409).json({
                error: 'Call already in progress for this patient',
                code: ERROR_CODES.DUPLICATE_CALL
            });
        }

        // ============================================================
        // CREATE CALL RECORD
        // ============================================================
        const { data: callRecord, error: callError } = await supabase
            .from('ai_calls')
            .insert({
                clinic_id: fetchedClinicId,
                appointment_id: appointment?.id || null,
                patient_id: patient.id,
                phone_number: patientPhone,
                call_type: call_type,
                status: 'queued',
                model_version: 'gemini-1.5-pro-hardened',
                processing_time_ms: 0
            })
            .select()
            .single();

        if (callError) {
            logger.error('Failed to create call record', { error: callError.message });
            return res.status(500).json({ error: 'Database error', code: ERROR_CODES.DATABASE_ERROR });
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
                statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed', 'busy', 'failed', 'no-answer'],
                timeout: 60
            });
        } catch (twilioErr) {
            logger.error('Twilio call initiation failed', { error: (twilioErr as Error).message });
            await supabase.from('ai_calls').update({
                status: 'failed',
                escalation_reason: 'Twilio API Error: ' + (twilioErr as Error).message
            }).eq('id', callRecord.id);

            return res.status(502).json({
                error: 'Failed to initiate call',
                code: ERROR_CODES.TWILIO_ERROR
            });
        }

        // Update call record with Twilio SID
        await supabase
            .from('ai_calls')
            .update({
                external_call_id: call.sid,
                status: 'calling',
                call_started_at: new Date().toISOString()
            })
            .eq('id', callRecord.id);

        logger.info('Outbound call initiated successfully', {
            callId: callRecord.id,
            twilioSid: call.sid,
            patientId: patient.id,
            callType: call_type
        });

        return res.status(201).json({
            success: true,
            call_id: callRecord.id,
            twilio_sid: call.sid
        });

    } catch (error) {
        logger.error('Outbound call failed', { error: (error as Error).message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;

