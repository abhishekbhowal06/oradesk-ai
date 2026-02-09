import Stripe from 'stripe';
import { logger } from './logger';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
    logger.warn('Missing STRIPE_SECRET_KEY - Billing features disabled');
}

export const stripe = STRIPE_SECRET_KEY
    ? new Stripe(STRIPE_SECRET_KEY)
    : null;

// Pricing tiers
export const PRICING_TIERS = {
    starter: {
        name: 'Starter',
        priceId: process.env.STRIPE_STARTER_PRICE_ID || '',
        monthlyCallLimit: 100,
        userLimit: 1,
        price: 99
    },
    pro: {
        name: 'Pro',
        priceId: process.env.STRIPE_PRO_PRICE_ID || '',
        monthlyCallLimit: 500,
        userLimit: 5,
        price: 299
    },
    enterprise: {
        name: 'Enterprise',
        priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
        monthlyCallLimit: -1, // Unlimited
        userLimit: -1,
        price: null // Custom pricing
    }
};

export type PricingTier = keyof typeof PRICING_TIERS;

export function getTierByPriceId(priceId: string): PricingTier | null {
    for (const [tier, config] of Object.entries(PRICING_TIERS)) {
        if (config.priceId === priceId) {
            return tier as PricingTier;
        }
    }
    return null;
}
