/* eslint-disable */
// ============================================================================
// DENTACORE OS - FULL SYSTEM VERIFICATION
// Run this script to verify the health of Phases 1-6.
// Usage: npx ts-node scripts/verify_system_health.ts
// ============================================================================

/*
PREREQUISITES:
1. Ensure your .env file has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
2. Ensure you have run migration: 20260210_phase1_foundation.sql
3. Ensure you have run seed: seed_phase1.sql
*/

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error(
    '❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Cannot run automated check.',
  );
  console.log('\n--- MANUAL VERIFICATION STEPS ---');
  console.log('1. Phase 1 (Foundation): Check if table "recall_candidates" exists and has data.');
  console.log('2. Phase 2 (Campaigns): Check if table "campaigns" exists.');
  console.log('3. Phase 3 (Outreach): Check if table "outreach_jobs" exists.');
  console.log('4. Phase 4 (Leads): Check if table "lead_queue" exists.');
  console.log('5. Phase 5 (Attribution): Check if table "revenue_attribution" exists.');
  console.log('6. Phase 6 (Integrations): Check if table "pms_sync_state" exists.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySystem() {
  console.log('🔍 Starting System Health Check...\n');

  try {
    // --- PHASE 1: FOUNDATION ---
    console.log('Checking Phase 1: Foundation Data Layer...');
    const { count: patientCount, error: pError } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true });
    if (pError) throw pError;
    console.log(`✅ Patients Table: Accessible (${patientCount} records)`);

    // --- PHASE 2: CAMPAIGNS ---
    console.log('\nChecking Phase 2: Campaign Engine...');
    const { count: campaignCount, error: cError } = await supabase
      .from('campaigns')
      .select('*', { count: 'exact', head: true });
    if (cError) throw cError;
    console.log(`✅ Campaigns Table: Accessible (${campaignCount} records)`);

    const { count: recallCount, error: rError } = await supabase
      .from('recall_candidates')
      .select('*', { count: 'exact', head: true });
    if (rError) throw rError;
    console.log(`✅ Recall Candidates: Accessible (${recallCount} records)`);

    // --- PHASE 3: OUTREACH ---
    console.log('\nChecking Phase 3: Outreach Engine...');
    const { count: jobCount, error: jError } = await supabase
      .from('outreach_jobs')
      .select('*', { count: 'exact', head: true });
    if (jError) throw jError;
    console.log(`✅ Outreach Jobs: Accessible (${jobCount} records)`);

    // --- PHASE 4: LEADS ---
    console.log('\nChecking Phase 4: Lead Handling...');
    const { count: leadCount, error: lError } = await supabase
      .from('lead_queue')
      .select('*', { count: 'exact', head: true });
    if (lError) throw lError;
    console.log(`✅ Lead Queue: Accessible (${leadCount} records)`);

    // --- PHASE 5: ATTRIBUTION ---
    console.log('\nChecking Phase 5: Revenue Attribution...');
    const { count: attrCount, error: aError } = await supabase
      .from('revenue_attribution')
      .select('*', { count: 'exact', head: true });
    if (aError) throw aError;
    console.log(`✅ Attribution Table: Accessible (${attrCount} records)`);

    // --- PHASE 6: INTEGRATIONS ---
    console.log('\nChecking Phase 6: Sync Bridge...');
    const { count: syncCount, error: sError } = await supabase
      .from('pms_sync_state')
      .select('*', { count: 'exact', head: true });
    if (sError) throw sError;
    console.log(`✅ PMS Sync State: Accessible (${syncCount} records)`);

    console.log('\n✨ ALL SYSTEMS OPERATIONAL ✨');
  } catch (error: any) {
    console.error('\n❌ VERIFICATION FAILED:', error.message);
  }
}

verifySystem();
