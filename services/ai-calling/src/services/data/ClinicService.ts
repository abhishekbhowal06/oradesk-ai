import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logging/structured-logger';
import { SimpleCache } from '../../lib/cache';

export interface ClinicConfig {
  id: string;
  name: string;
  ai_settings: {
    confirmation_calls_enabled: boolean;
    reminder_hours_before: number;
  };
  subscription_status: string;
}

export class ClinicService {
  private logger = logger.child({ module: 'ClinicService' });
  private configCache = new SimpleCache<ClinicConfig>(5 * 60 * 1000); // 5 minutes TTL

  /**
   * Fetch clinic configuration/settings by ID
   */
  async getClinicConfig(clinicId: string): Promise<ClinicConfig | null> {
    // 1. Check Cache
    const cached = this.configCache.get(clinicId);
    if (cached) {
      return cached;
    }

    try {
      const { data, error } = await supabase
        .from('clinics')
        .select('id, name, ai_settings, subscription_status')
        .eq('id', clinicId)
        .single();

      if (error) {
        this.logger.error('Failed to fetch clinic config', { clinicId, error });
        return null;
      }

      // 2. Set Cache
      this.configCache.set(clinicId, data as ClinicConfig);

      return data as ClinicConfig;
    } catch (err) {
      this.logger.error('getClinicConfig exception', { clinicId, error: err });
      return null;
    }
  }

  /**
   * Check if a clinic has an active subscription
   */
  async checkSubscription(clinicId: string): Promise<boolean> {
    const config = await this.getClinicConfig(clinicId);
    if (!config) return false;

    const status = config.subscription_status;
    const isActive = status === 'active' || status === 'trialing';

    if (!isActive) {
      this.logger.warn('Clinic subscription inactive', { clinicId, status });
    }

    return isActive;
  }
}

export const clinicService = new ClinicService();
