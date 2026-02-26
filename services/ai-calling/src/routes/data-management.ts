/**
 * DATA MANAGEMENT ROUTES — GDPR / Data Deletion
 *
 * Provides GDPR Article 17 "Right to Erasure" compliance.
 * All deletions are logged to the immutable audit log.
 *
 * Routes:
 *   POST /v1/data/patient/:patientId/delete  → Anonymize/delete patient data
 *   POST /v1/data/export                     → Export patient data (Art. 20)
 */

import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logging/structured-logger';
import { logDataDeletion, logAdminAction } from '../lib/audit-logger';

const router = Router();

/**
 * POST /v1/data/patient/:patientId/delete
 *
 * GDPR Article 17 — Right to Erasure
 * Anonymizes patient PII while preserving aggregate data for analytics.
 * Does NOT delete call records (required for billing/compliance audit trail).
 *
 * SECURITY: Requires admin role. Uses supabaseAdmin for cross-table cleanup.
 */
router.post('/patient/:patientId/delete', async (req, res) => {
    const clinicId = req.clinicId;
    const userId = req.user?.sub;
    const { patientId } = req.params;
    const { reason } = req.body;

    if (!clinicId || !userId) {
        return res.status(400).json({ error: 'Missing clinic context' });
    }

    if (!patientId) {
        return res.status(400).json({ error: 'Missing patientId' });
    }

    try {
        // 1. Verify patient belongs to this clinic (using user-scoped client)
        const { data: patient, error: patientError } = await req.supabaseUser!
            .from('patients')
            .select('id, clinic_id, first_name, last_name')
            .eq('id', patientId)
            .eq('clinic_id', clinicId)
            .single();

        if (patientError || !patient) {
            return res.status(404).json({ error: 'Patient not found in your clinic' });
        }

        // 2. Anonymize patient record (replace PII with placeholder)
        // JUSTIFICATION: supabaseAdmin needed for cross-table cascade
        const anonymizedData = {
            first_name: '[DELETED]',
            last_name: '[DELETED]',
            phone: '[DELETED]',
            email: null,
            date_of_birth: null,
            address: null,
            insurance_info: null,
            medical_notes: null,
            deleted_at: new Date().toISOString(),
            deleted_by: userId,
            deletion_reason: reason || 'GDPR erasure request',
        };

        const { error: updateError } = await supabaseAdmin
            .from('patients')
            .update(anonymizedData)
            .eq('id', patientId)
            .eq('clinic_id', clinicId);

        if (updateError) {
            logger.error('Failed to anonymize patient', { patientId, error: updateError.message });
            return res.status(500).json({ error: 'Failed to delete patient data' });
        }

        // 3. Anonymize related records
        // Anonymize call transcripts (keep call records for billing)
        await supabaseAdmin
            .from('ai_calls')
            .update({
                transcript: null,
                recording_url: null,
                call_summary: '[REDACTED — GDPR deletion]',
            })
            .eq('patient_id', patientId)
            .eq('clinic_id', clinicId);

        // Remove from recall candidates
        await supabaseAdmin
            .from('recall_candidates')
            .delete()
            .eq('patient_id', patientId)
            .eq('clinic_id', clinicId);

        // Anonymize follow-up tasks
        await supabaseAdmin
            .from('follow_up_tasks')
            .update({ notes: '[REDACTED — GDPR deletion]' })
            .eq('patient_id', patientId)
            .eq('clinic_id', clinicId);

        // 4. Log to immutable audit trail
        await logDataDeletion(
            clinicId,
            userId,
            'patient',
            patientId,
            ['first_name', 'last_name', 'phone', 'email', 'date_of_birth', 'address', 'insurance_info', 'medical_notes', 'transcripts', 'recordings'],
        );

        logger.info('Patient data deleted (GDPR)', { clinicId, patientId, userId });

        res.json({
            success: true,
            message: 'Patient data has been anonymized per GDPR Article 17',
            patient_id: patientId,
            fields_deleted: ['first_name', 'last_name', 'phone', 'email', 'date_of_birth', 'address', 'insurance_info', 'medical_notes'],
            related_data_cleaned: ['call_transcripts', 'recordings', 'recall_candidates', 'follow_up_notes'],
            audit_logged: true,
        });
    } catch (error) {
        logger.error('GDPR deletion failed', { patientId, error: (error as Error).message });
        res.status(500).json({ error: 'Data deletion failed' });
    }
});

/**
 * POST /v1/data/export
 *
 * GDPR Article 20 — Right to Data Portability
 * Exports all patient data for a clinic in JSON format.
 */
router.post('/export', async (req, res) => {
    const clinicId = req.clinicId;
    const userId = req.user?.sub;
    const { patient_id } = req.body;

    if (!clinicId || !userId) {
        return res.status(400).json({ error: 'Missing clinic context' });
    }

    try {
        const userClient = req.supabaseUser!;

        // Fetch patient data
        let patientQuery = userClient.from('patients').select('*').eq('clinic_id', clinicId);
        if (patient_id) patientQuery = patientQuery.eq('id', patient_id);

        const { data: patients } = await patientQuery;

        // Fetch appointments
        let apptQuery = userClient.from('appointments').select('*').eq('clinic_id', clinicId);
        if (patient_id) apptQuery = apptQuery.eq('patient_id', patient_id);

        const { data: appointments } = await apptQuery;

        // Fetch call records (without transcripts for security)
        let callQuery = userClient
            .from('ai_calls')
            .select('id, patient_id, call_type, status, outcome, duration_seconds, created_at')
            .eq('clinic_id', clinicId);
        if (patient_id) callQuery = callQuery.eq('patient_id', patient_id);

        const { data: calls } = await callQuery;

        // Log the export action
        await logAdminAction(clinicId, userId, 'admin.data_export', 'clinic', clinicId, {
            patient_id: patient_id || 'all',
            patients_exported: patients?.length || 0,
        });

        res.json({
            export_date: new Date().toISOString(),
            clinic_id: clinicId,
            data: {
                patients: patients || [],
                appointments: appointments || [],
                call_records: calls || [],
            },
            metadata: {
                format: 'JSON',
                gdpr_article: '20 — Right to Data Portability',
            },
        });
    } catch (error) {
        logger.error('Data export failed', { error: (error as Error).message });
        res.status(500).json({ error: 'Data export failed' });
    }
});

export default router;
