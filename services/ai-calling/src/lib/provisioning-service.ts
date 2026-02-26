import { supabaseAdmin } from './supabase';
import { logger } from './logging/structured-logger';

export class ProvisioningService {
    /**
     * Performs full setup for a new tenant (clinic).
     * 1. Updates default settings.
     * 2. Seeds demo data.
     * 3. Provisions initial feature flags.
     */
    static async provisionClinic(clinicId: string): Promise<void> {
        logger.info('Provisioning new clinic', { clinicId });

        try {
            await Promise.all([
                this.setupDefaultSettings(clinicId),
                this.seedDemoData(clinicId),
                this.provisionInitialFlags(clinicId),
            ]);
            logger.info('Clinic provisioning complete', { clinicId });
        } catch (error) {
            logger.error('Clinic provisioning failed', { clinicId, error: (error as Error).message });
            // We don't throw here to avoid blocking the main signup flow, 
            // but the failure is logged for manual remediation.
        }
    }

    private static async setupDefaultSettings(clinicId: string): Promise<void> {
        const { error } = await supabaseAdmin
            .from('clinics')
            .update({
                ai_settings: {
                    confirmation_calls_enabled: true,
                    reminder_hours_before: 24,
                    max_follow_up_attempts: 3,
                    follow_up_delay_hours: 4,
                    voice_provider: 'elevenlabs',
                    voice_id: 'saR99867776554' // Default professional voice
                },
                notification_settings: {
                    email_enabled: true,
                    sms_enabled: true,
                    action_required_timing: 'immediate'
                }
            })
            .eq('id', clinicId);

        if (error) throw new Error(`Default settings setup failed: ${error.message}`);
    }

    private static async seedDemoData(clinicId: string): Promise<void> {
        // 1. Create a Demo Patient
        const { data: patient, error: patientError } = await supabaseAdmin
            .from('patients')
            .insert({
                clinic_id: clinicId,
                first_name: 'Demo',
                last_name: 'Patient (Tutorial)',
                phone: '+15550000000',
                email: 'demo@example.com',
                notes: 'This is a demo patient created for your onboarding tour.'
            })
            .select()
            .single();

        if (patientError) throw new Error(`Demo patient seeding failed: ${patientError.message}`);

        // 2. Create an Initial Task
        const { error: taskError } = await supabaseAdmin
            .from('staff_tasks')
            .insert({
                clinic_id: clinicId,
                patient_id: patient.id,
                title: 'Welcome to OraDesk AI',
                description: 'Complete your clinic profile and verify your Twilio phone number to start making AI calls.',
                priority: 'high',
                status: 'pending'
            });

        if (taskError) throw new Error(`Demo task seeding failed: ${taskError.message}`);
    }

    private static async provisionInitialFlags(clinicId: string): Promise<void> {
        const defaultFlags = [
            { flag_key: 'v2_analytics', is_enabled: true, clinic_id: clinicId },
            { flag_key: 'custom_ai_voices', is_enabled: false, clinic_id: clinicId }
        ];

        const { error } = await supabaseAdmin
            .from('feature_flags')
            .upsert(defaultFlags);

        if (error) throw new Error(`Feature flag provisioning failed: ${error.message}`);
    }
}
