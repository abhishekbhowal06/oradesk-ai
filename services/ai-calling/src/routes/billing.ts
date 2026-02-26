import { Router } from 'express';
import { stripe, PRICING_TIERS, getTierByPriceId, PricingTier } from '../lib/stripe';
import { logger } from '../lib/logging/structured-logger';

const router = Router();

// POST /v1/billing/checkout - Create Stripe Checkout Session
router.post('/checkout', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Billing not configured' });
  }

  const { tier, success_url, cancel_url } = req.body;
  // TRUSTED SOURCE: Middleware validated this
  const clinic_id = req.clinicId;

  if (!tier || !clinic_id) {
    return res.status(400).json({ error: 'Missing tier or clinic_id context' });
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
        tier,
      },
    });

    logger.info(`Checkout session created for clinic ${clinic_id}, tier ${tier}`);
    res.json({ url: session.url, session_id: session.id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Checkout session creation failed', { error: message });
    res.status(500).json({ error: message });
  }
});

// POST /v1/billing/portal - Create Customer Portal Session
router.post('/portal', async (req, res) => {
  if (!stripe) {
    return res.status(503).json({ error: 'Billing not configured' });
  }

  // TRUSTED SOURCE: Middleware validated this
  const clinic_id = req.clinicId;

  if (!clinic_id) {
    return res.status(400).json({ error: 'Missing clinic_id context' });
  }

  try {
    // Get Stripe customer ID from clinic
    const { data: clinic, error } = await req.supabaseUser!
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Portal session creation failed', { error: message });
    res.status(500).json({ error: message });
  }
});

// GET /v1/billing/usage/:clinic_id - Get current usage stats
// Security Upgrade: Validate params against authorized context
router.get('/usage/:clinic_id', async (req, res) => {
  const { clinic_id } = req.params;
  const authorizedClinicId = req.clinicId;

  if (clinic_id !== authorizedClinicId) {
    logger.warn(`Billing Usage IDOR attempted`, {
      authorized: authorizedClinicId,
      requested: clinic_id,
    });
    return res.status(403).json({ error: 'Access denied to this clinic usage data' });
  }

  try {
    const { redisClient } = require('../lib/redis');
    const cacheKey = `billing_usage:${clinic_id}`;

    // 1. Try Cache
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
    } catch (e) {
      logger.warn('Redis cache read failed for billing usage', { error: (e as Error).message });
    }

    // 2. Cache Miss - Fetch from Database
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: calls, error } = await req.supabaseUser!
      .from('ai_calls')
      .select('id', { count: 'exact' })
      .eq('clinic_id', clinic_id)
      .gte('created_at', startOfMonth.toISOString());

    if (error) {
      logger.error('Usage query failed', error);
      return res.status(500).json({ error: 'Failed to fetch usage' });
    }

    // Get clinic subscription tier
    const { data: clinic } = await req.supabaseUser!
      .from('clinics')
      .select('subscription_tier, subscription_status')
      .eq('id', clinic_id)
      .single();

    const tier = (clinic?.subscription_tier as PricingTier) || 'starter';
    const tierConfig = PRICING_TIERS[tier];
    const callCount = calls?.length || 0;
    const limit = tierConfig.monthlyCallLimit;

    // ── Enterprise Enhancement: Fetch Historical Trends (6 Months) ──
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    sixMonthsAgo.setDate(1);

    const { data: historicalData } = await req.supabaseUser!
      .from('ai_calls')
      .select('created_at')
      .eq('clinic_id', clinic_id)
      .gte('created_at', sixMonthsAgo.toISOString());

    // Aggregate by month
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trends = (historicalData || []).reduce((acc: any, call: any) => {
      const month = months[new Date(call.created_at).getMonth()];
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {});

    // Calculate Forecast
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const currentDay = new Date().getDate();
    const dailyVelocity = callCount / Math.max(currentDay, 1);
    const projectedUsage = Math.round(dailyVelocity * daysInMonth);

    const responseData = {
      tier,
      status: clinic?.subscription_status || 'inactive',
      usage: {
        calls: callCount,
        limit: limit === -1 ? 'unlimited' : limit,
        percentage: limit === -1 ? 0 : Math.round((callCount / limit) * 100),
        forecasted: projectedUsage
      },
      trends: Object.keys(trends).map(m => ({ month: m, count: trends[m] }))
    };

    // 3. Populate Cache (TTL 5 mins)
    try {
      await redisClient.setex(cacheKey, 300, JSON.stringify(responseData));
    } catch (e) {
      logger.warn('Redis cache write failed for billing usage', { error: (e as Error).message });
    }

    res.json(responseData);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Usage fetch failed', { error: message });
    res.status(500).json({ error: message });
  }
});

export default router;
