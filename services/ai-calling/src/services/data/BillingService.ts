import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logging/structured-logger';
import { configService } from './ConfigService';
import { SubscriptionTier } from '../../types';

export interface QuotaStatus {
  allowed: boolean;
  currentUsage: number;
  limit: number;
  reason?: string;
}

export class BillingService {
  private logger = logger.child({ module: 'BillingService' });

  /**
   * Check clinic quota for the current billing period
   */
  async checkClinicQuota(clinicId: string): Promise<QuotaStatus> {
    // 1. Get clinic subscription info
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('subscription_tier, subscription_status')
      .eq('id', clinicId)
      .single();

    if (clinicError || !clinic) {
      this.logger.error('Clinic not found during quota check', { clinicId, error: clinicError });
      return { allowed: false, currentUsage: 0, limit: 0, reason: 'Clinic not found' };
    }

    // 2. Check subscription status
    if (clinic.subscription_status !== 'active' && clinic.subscription_status !== 'trialing') {
      return { allowed: false, currentUsage: 0, limit: 0, reason: 'SUBSCRIPTION_INACTIVE' };
    }

    // 3. Get tier limit from ConfigService
    const tier = (clinic.subscription_tier || 'free') as SubscriptionTier;
    const limit = configService.getTierLimit(tier);

    // 4. Count calls this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count, error: countError } = await supabase
      .from('ai_calls')
      .select('*', { count: 'exact', head: true })
      .eq('clinic_id', clinicId)
      .gte('created_at', startOfMonth.toISOString());

    if (countError) {
      this.logger.error('Failed to count calls for quota check', {
        clinicId,
        error: countError.message,
      });
      // Fail open for now (business decision to not block if DB fails)
      return { allowed: true, currentUsage: 0, limit };
    }

    const currentUsage = count || 0;
    const allowed = currentUsage < limit;

    return {
      allowed,
      currentUsage,
      limit,
      reason: allowed ? undefined : 'QUOTA_EXCEEDED',
    };
  }
}

export const billingService = new BillingService();
