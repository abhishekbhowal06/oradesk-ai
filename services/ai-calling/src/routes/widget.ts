import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// POST /v1/appointments/request - Widget appointment request
router.post('/request', async (req, res) => {
    const { first_name, last_name, phone, reason, notes, clinic_id } = req.body;

    if (!first_name || !last_name || !phone || !clinic_id) {
        return res.status(400).json({
            error: 'Missing required fields',
            required: ['first_name', 'last_name', 'phone', 'clinic_id']
        });
    }

    try {
        // 1. Find or create patient
        let patientId: string;

        const { data: existingPatient } = await supabase
            .from('patients')
            .select('id')
            .eq('clinic_id', clinic_id)
            .eq('phone', phone)
            .single();

        if (existingPatient) {
            patientId = existingPatient.id;
            logger.info(`Widget: Found existing patient ${patientId}`);
        } else {
            const { data: newPatient, error: patientError } = await supabase
                .from('patients')
                .insert({
                    clinic_id,
                    first_name,
                    last_name,
                    phone,
                    source: 'widget'
                })
                .select('id')
                .single();

            if (patientError) {
                logger.error('Widget: Failed to create patient', patientError);
                return res.status(500).json({ error: 'Failed to create patient record' });
            }

            patientId = newPatient.id;
            logger.info(`Widget: Created new patient ${patientId}`);
        }

        // 2. Create appointment request
        const { data: appointment, error: appointmentError } = await supabase
            .from('appointments')
            .insert({
                clinic_id,
                patient_id: patientId,
                status: 'pending',
                procedure_name: mapReasonToProcedure(reason),
                notes: notes || null,
                ai_managed: true,
                source: 'widget'
            })
            .select('id')
            .single();

        if (appointmentError) {
            logger.error('Widget: Failed to create appointment', appointmentError);
            return res.status(500).json({ error: 'Failed to create appointment' });
        }

        logger.info(`Widget: Created appointment request ${appointment.id} for patient ${patientId}`);

        // 3. Optionally trigger callback call
        // This would queue an AI call to confirm the appointment
        // For now, we just acknowledge the request

        res.status(201).json({
            success: true,
            message: 'Appointment request received',
            appointment_id: appointment.id
        });

    } catch (error) {
        logger.error('Widget: Unexpected error', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

function mapReasonToProcedure(reason: string): string {
    const map: Record<string, string> = {
        'cleaning': 'Cleaning & Checkup',
        'pain': 'Emergency Consultation',
        'cosmetic': 'Cosmetic Consultation',
        'followup': 'Follow-up Visit',
        'other': 'General Consultation'
    };
    return map[reason] || 'General Consultation';
}

export default router;
