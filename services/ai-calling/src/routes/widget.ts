import { Router } from 'express';
import { logger } from '../lib/logging/structured-logger';
import { validateBody, WidgetAppointmentSchema } from '../lib/validation';

const router = Router();

// POST /v1/appointments/request - Widget appointment request
// SECURITY: Uses req.supabaseUser (RLS-respecting) and req.clinicId (trusted from middleware)
router.post('/request', validateBody(WidgetAppointmentSchema), async (req, res) => {
  const clinicId = req.clinicId; // TRUSTED: from requireClinicAccess middleware
  const { first_name, last_name, phone, reason, notes } = req.body;

  if (!first_name || !last_name || !phone || !clinicId) {
    return res.status(400).json({
      error: 'Missing required fields',
      required: ['first_name', 'last_name', 'phone'],
    });
  }

  const userClient = req.supabaseUser!;

  try {
    // 1. Atomic Upsert for Patient (Fixes Race Condition)
    const { data: patient, error: patientError } = await userClient
      .from('patients')
      .upsert(
        {
          clinic_id: clinicId,
          first_name,
          last_name,
          phone,
          source: 'widget',
        },
        {
          onConflict: 'clinic_id, phone',
          ignoreDuplicates: false
        }
      )
      .select('id')
      .single();

    if (patientError) {
      logger.error('Widget: Failed to upsert patient', { error: patientError.message });
      return res.status(500).json({ error: 'Failed to create patient record' });
    }

    const patientId = patient.id;
    logger.info(`Widget: Upserted patient ${patientId}`);

    // 2. Create appointment request
    const { data: appointment, error: appointmentError } = await userClient
      .from('appointments')
      .insert({
        clinic_id: clinicId,
        patient_id: patientId,
        status: 'pending',
        procedure_name: mapReasonToProcedure(reason),
        notes: notes || null,
        ai_managed: true,
        source: 'widget',
      })
      .select('id')
      .single();

    if (appointmentError) {
      logger.error('Widget: Failed to create appointment', { error: appointmentError.message });
      return res.status(500).json({ error: 'Failed to create appointment' });
    }

    logger.info(`Widget: Created appointment request ${appointment.id} for patient ${patientId}`);

    res.status(201).json({
      success: true,
      message: 'Appointment request received',
      appointment_id: appointment.id,
    });
  } catch (error) {
    logger.error('Widget: Unexpected error', { error: (error as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

function mapReasonToProcedure(reason: string): string {
  const map: Record<string, string> = {
    cleaning: 'Cleaning & Checkup',
    pain: 'Emergency Consultation',
    cosmetic: 'Cosmetic Consultation',
    followup: 'Follow-up Visit',
    other: 'General Consultation',
  };
  return map[reason] || 'General Consultation';
}

export default router;
