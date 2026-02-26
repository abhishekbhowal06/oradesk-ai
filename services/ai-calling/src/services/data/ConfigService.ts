import { SubscriptionTier } from '../../types';

export const TIER_LIMITS: Record<SubscriptionTier, number> = {
  free: 10,
  starter: 100,
  growth: 500,
  professional: 2000,
  enterprise: 10000,
};

export class ConfigService {
  getTierLimit(tier: SubscriptionTier): number {
    return TIER_LIMITS[tier] || TIER_LIMITS['free'];
  }

  // Additional configuration methods can be added here
}

export const configService = new ConfigService();
