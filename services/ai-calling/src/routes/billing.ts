import { Router } from 'express';
import { stripe, PRICING_TIERS, getTierByPriceId, PricingTier } from '../lib/stripe';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// POST /v1/billing/checkout - Create Stripe Checkout Session
router.post('/checkout', async (req, res) => {
    if (!stripe) {
        return res.status(503).json({ error: 'Billing not configured' });
    }

    const { tier, clinic_id, success_url, cancel_url } = req.body;

    if (!tier || !clinic_id) {
        return res.status(400).json({ error: 'Missing tier or clinic_id' });
    }

    const selectedTier = PRICING_TIERS[tier as PricingTier];
    if (!selectedTier || !selectedTier.priceId) {
        return res.status(400).json({ error: 'Invalid tier or tier not configured' });
    }

    try {
        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: selectedTier.priceId,
                    quantity: 1,
                },
            ],
            success_url: success_url || `${process.env.FRONTEND_URL}/settings?billing=success`,
            cancel_url: cancel_url || `${process.env.FRONTEND_URL}/settings?billing=cancelled`,
            metadata: {
                clinic_id,
                tier
            },
        });

        logger.info(`Checkout session created for clinic ${clinic_id}, tier ${tier}`);
        res.json({ url: session.url, session_id: session.id });
    } catch (error: any) {
        logger.error('Checkout session creation failed', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /v1/billing/portal - Create Customer Portal Session
router.post('/portal', async (req, res) => {
    if (!stripe) {
        return res.status(503).json({ error: 'Billing not configured' });
    }

    const { clinic_id } = req.body;

    if (!clinic_id) {
        return res.status(400).json({ error: 'Missing clinic_id' });
    }

    try {
        // Get Stripe customer ID from clinic
        const { data: clinic, error } = await supabase
            .from('clinics')
            .select('stripe_customer_id')
            .eq('id', clinic_id)
            .single();

        if (error || !clinic?.stripe_customer_id) {
            return res.status(404).json({ error: 'No billing information found' });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: clinic.stripe_customer_id,
            return_url: `${process.env.FRONTEND_URL}/settings`,
        });

        res.json({ url: session.url });
    } catch (error: any) {
        logger.error('Portal session creation failed', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /v1/billing/usage - Get current usage stats
router.get('/usage/:clinic_id', async (req, res) => {
    const { clinic_id } = req.params;

    try {
        // Get current month's call count
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: calls, error } = await supabase
            .from('ai_calls')
            .select('id', { count: 'exact' })
            .eq('clinic_id', clinic_id)
            .gte('created_at', startOfMonth.toISOString());

        if (error) {
            logger.error('Usage query failed', error);
            return res.status(500).json({ error: 'Failed to fetch usage' });
        }

        // Get clinic subscription tier
        const { data: clinic } = await supabase
            .from('clinics')
            .select('subscription_tier, subscription_status')
            .eq('id', clinic_id)
            .single();

        const tier = (clinic?.subscription_tier as PricingTier) || 'starter';
        const tierConfig = PRICING_TIERS[tier];
        const callCount = calls?.length || 0;
        const limit = tierConfig.monthlyCallLimit;

        res.json({
            tier,
            status: clinic?.subscription_status || 'inactive',
            usage: {
                calls: callCount,
                limit: limit === -1 ? 'unlimited' : limit,
                percentage: limit === -1 ? 0 : Math.round((callCount / limit) * 100)
            }
        });
    } catch (error: any) {
        logger.error('Usage fetch failed', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
