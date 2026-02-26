import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { stripe, getTierByPriceId } from '../lib/stripe';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logging/structured-logger';
import { EmailService } from '../services/email-service';
import { checkAndLockWebhook } from '../lib/idempotency';

const router = Router();

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// POST /v1/webhooks/stripe - Stripe Webhook Handler
router.post('/stripe', async (req: Request, res: Response) => {
  if (!stripe) {
    return res.status(503).send('Billing not configured');
  }

  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    // Verify webhook signature
    if (WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
    } else {
      // Development only - skip signature verification
      event = req.body as Stripe.Event;
      logger.warn('Stripe webhook signature verification skipped (dev mode)');
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Webhook signature verification failed', { error: message });
    return res.status(400).send(`Webhook Error: ${message}`);
  }

  logger.info(`Stripe webhook received: ${event.type}`);

  try {
    // ─── IDEMPOTENCY CHECK ───
    const isNew = await checkAndLockWebhook('stripe', event.id);
    if (!isNew) {
      // Return 200 OK so Stripe stops retrying this duplicate event.
      res.json({ received: true, note: 'duplicate_event_ignored' });
      return;
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutComplete(session);
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCancelled(subscription);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }
      default:
        logger.info(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Webhook processing failed', { error: message });
    res.status(500).json({ error: message });
  }
});

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const clinicId = session.metadata?.clinic_id;
  const tier = session.metadata?.tier;

  if (!clinicId) {
    logger.error('Checkout complete but missing clinic_id');
    return;
  }

  // Update clinic with subscription info
  const { error } = await supabase
    .from('clinics')
    .update({
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: session.subscription as string,
      subscription_tier: tier || 'starter',
      subscription_status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', clinicId);

  if (error) {
    logger.error('Failed to update clinic subscription', error);
    return;
  }

  logger.info(`Clinic ${clinicId} subscription activated: ${tier}`);
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price.id;
  const tier = getTierByPriceId(priceId);

  // Find clinic by subscription ID
  const { data: clinic, error: findError } = await supabase
    .from('clinics')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (findError || !clinic) {
    logger.error('Could not find clinic for subscription update', findError);
    return;
  }

  const { error } = await supabase
    .from('clinics')
    .update({
      subscription_tier: tier || 'starter',
      subscription_status: subscription.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clinic.id);

  if (error) {
    logger.error('Failed to update subscription', error);
    return;
  }

  logger.info(`Clinic ${clinic.id} subscription updated: ${tier}, ${subscription.status}`);
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  const { data: clinic } = await supabase
    .from('clinics')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!clinic) {
    return;
  }

  await supabase
    .from('clinics')
    .update({
      subscription_status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', clinic.id);

  logger.info(`Clinic ${clinic.id} subscription cancelled`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const { data: clinic } = await supabase
    .from('clinics')
    .select('id, name')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!clinic) {
    return;
  }

  await supabase
    .from('clinics')
    .update({
      subscription_status: 'past_due',
      subscription_tier: 'free', // AUTO-DOWNGRADE
      updated_at: new Date().toISOString(),
    })
    .eq('id', clinic.id);

  logger.warn(`Clinic ${clinic.id} payment failed - downgraded to FREE`);

  // Send Alert to Clinic Admin
  // We need to fetch the admin email first
  const { data: adminUser } = await supabase
    .from('users')
    .select('email, first_name')
    .eq('clinic_id', clinic.id)
    .eq('role', 'admin') // Assuming 'admin' role exists
    .limit(1)
    .single();

  if (adminUser?.email) {
    await EmailService.sendPaymentFailedAlert(adminUser.email, clinic.name || 'Your Clinic');
  }
}

export default router;
