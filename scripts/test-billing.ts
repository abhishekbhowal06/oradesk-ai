import axios from 'axios';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Load environment variables
dotenv.config({ path: 'services/ai-calling/.env' });

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Use SERVICE_ROLE_KEY
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const API_URL = 'http://localhost:8080';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
// Initialize Stripe purely for signature generation if needed (key doesn't matter for signature gen usually, but we need the library)
// We might not have the library imported here? We verify 'stripe' is in package.json
// If not, we can assume payload signing isn't possible without the lib.
// But we can construct the signature manually or skip if secret is missing.

async function runTest() {
  console.log('🚀 Starting Billing Verification Test...');

  // 1. Get a target clinic
  const { data: clinic, error } = await supabase
    .from('clinics')
    .select('id, name, subscription_status')
    .limit(1)
    .single();

  if (error || !clinic) {
    console.error('❌ Could not find a clinic to test:', error);
    return;
  }

  console.log(`📋 Testing with Clinic: ${clinic.name} (${clinic.id})`);
  console.log(`   Initial Status: ${clinic.subscription_status}`);

  // 2. Prepare Webhook Payload
  const payload = {
    id: 'evt_test_webhook',
    object: 'event',
    type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    data: {
      object: {
        id: 'cs_test_session',
        object: 'checkout.session',
        customer: 'cus_test_customer',
        subscription: 'sub_test_subscription',
        metadata: {
          clinic_id: clinic.id,
          tier: 'pro',
        },
      },
    },
  };

  const payloadString = JSON.stringify(payload, null, 2); // Webhook receives raw body usually, but axios sends JSON info
  // However, signature verification needs the EXACT body string.
  // Axios sends JSON.stringify(payload).
  // So we must sign JSON.stringify(payload).
  const axiosBody = JSON.stringify(payload);

  // 3. Send Webhook
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (STRIPE_WEBHOOK_SECRET) {
      const timestamp = Math.floor(Date.now() / 1000);
      const signedPayload = `${timestamp}.${axiosBody}`;
      const hmac = crypto
        .createHmac('sha256', STRIPE_WEBHOOK_SECRET)
        .update(signedPayload)
        .digest('hex');

      headers['Stripe-Signature'] = `t=${timestamp},v1=${hmac}`;
      console.log('🔐 Generated Stripe Signature');
    } else {
      console.log('⚠️ No STRIPE_WEBHOOK_SECRET found - sending unsigned (dev mode)');
    }

    console.log(`📤 Sending webhook to ${API_URL}/v1/webhooks/stripe...`);
    const response = await axios.post(`${API_URL}/v1/webhooks/stripe`, payload, { headers });
    console.log(`✅ Webhook Response: ${response.status} ${response.statusText}`);
  } catch (err: any) {
    console.error('❌ Webhook Request Failed:', err.message);
    if (err.response) {
      console.error('   Server responded:', err.response.data);
    }
    return;
  }

  // 4. Verify Database Update
  console.log('⏳ Waiting for DB update...');
  await new Promise((r) => setTimeout(r, 2000));

  const { data: updatedClinic } = await supabase
    .from('clinics')
    .select('subscription_status, subscription_tier')
    .eq('id', clinic.id)
    .single();

  if (
    updatedClinic?.subscription_status === 'active' &&
    updatedClinic?.subscription_tier === 'pro'
  ) {
    console.log('✅ PASS: Subscription updated to ACTIVE / PRO');
  } else {
    console.error('❌ FAIL: Subscription did not update correctly');
    console.error('   Current Status:', updatedClinic?.subscription_status);
    console.error('   Current Tier:', updatedClinic?.subscription_tier);
  }
}

runTest();
