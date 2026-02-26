import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logging/structured-logger';

export class PatientService {
  private logger = logger.child({ module: 'PatientService' });

  /**
   * Check if patient has granted consent for automated contact
   */
  async checkPatientConsent(patientId: string): Promise<{ hasConsent: boolean; error?: string }> {
    const { data: consent, error } = await supabase
      .from('patient_consents')
      .select('granted, revoked_at')
      .eq('patient_id', patientId)
      .eq('consent_type', 'automated_contact')
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error('Consent check failed', { patientId, error: error.message });
    }

    // Consent must exist, be granted, and not revoked
    const hasConsent = consent?.granted === true && consent?.revoked_at === null;

    return { hasConsent };
  }
}

export const patientService = new PatientService();
