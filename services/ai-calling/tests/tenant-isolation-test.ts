/**
 * TENANT ISOLATION VERIFICATION TEST
 * ══════════════════════════════════════════════════════════════════
 *
 * Simulates two clinics (Clinic A & Clinic B) and verifies that:
 * 1. Clinic A's user can ONLY see Clinic A's data
 * 2. Clinic A's user CANNOT read, update, or delete Clinic B's data
 * 3. Cross-tenant writes are blocked
 * 4. Service role CAN access all data (for background workers)
 *
 * Usage:
 *   npx tsx services/ai-calling/tests/tenant-isolation-test.ts
 *
 * Requires:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET in .env
 */

import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET) {
    console.error('❌ Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_JWT_SECRET');
    process.exit(1);
}

// Admin client for setup/teardown
const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Create a user-scoped client impersonating a specific user
function createImpersonatedClient(userId: string): ReturnType<typeof createClient> {
    const payload = {
        sub: userId,
        aud: 'authenticated',
        role: 'authenticated',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const token = jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256' });

    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

interface TestResult {
    name: string;
    passed: boolean;
    details: string;
}

const results: TestResult[] = [];

function assert(name: string, condition: boolean, details: string) {
    results.push({ name, passed: condition, details });
    const icon = condition ? '✅' : '❌';
    console.log(`  ${icon} ${name}: ${details}`);
}

async function runTests() {
    console.log('\n══════════════════════════════════════════');
    console.log('  TENANT ISOLATION VERIFICATION');
    console.log('══════════════════════════════════════════\n');

    // ── Setup: Create test fixtures ──────────────────────────────
    console.log('📦 Setting up test fixtures...\n');

    // Create two test clinics
    const { data: clinicA } = await adminClient.from('clinics').insert({
        name: 'Test Clinic A (Isolation Test)',
        email: 'testa@isolation.test',
        subscription_tier: 'starter',
        subscription_status: 'active',
    }).select().single();

    const { data: clinicB } = await adminClient.from('clinics').insert({
        name: 'Test Clinic B (Isolation Test)',
        email: 'testb@isolation.test',
        subscription_tier: 'starter',
        subscription_status: 'active',
    }).select().single();

    if (!clinicA || !clinicB) {
        console.error('❌ Failed to create test clinics');
        return;
    }

    // Create two test auth users
    const { data: userAData } = await adminClient.auth.admin.createUser({
        email: `usera_${Date.now()}@isolation.test`,
        password: 'test-password-123!',
        email_confirm: true,
    });

    const { data: userBData } = await adminClient.auth.admin.createUser({
        email: `userb_${Date.now()}@isolation.test`,
        password: 'test-password-123!',
        email_confirm: true,
    });

    const userAId = userAData?.user?.id;
    const userBId = userBData?.user?.id;

    if (!userAId || !userBId) {
        console.error('❌ Failed to create test users');
        return;
    }

    // Create memberships
    await adminClient.from('staff_memberships').insert([
        { user_id: userAId, clinic_id: clinicA.id, role: 'admin' },
        { user_id: userBId, clinic_id: clinicB.id, role: 'admin' },
    ]);

    // Create test patients in each clinic
    const { data: patientA } = await adminClient.from('patients').insert({
        clinic_id: clinicA.id,
        first_name: 'Patient',
        last_name: 'Alpha',
        phone: '+1111111111',
    }).select().single();

    const { data: patientB } = await adminClient.from('patients').insert({
        clinic_id: clinicB.id,
        first_name: 'Patient',
        last_name: 'Bravo',
        phone: '+2222222222',
    }).select().single();

    if (!patientA || !patientB) {
        console.error('❌ Failed to create test patients');
        await cleanup(clinicA.id, clinicB.id, userAId, userBId);
        return;
    }

    // Create user-scoped clients
    const clientA = createImpersonatedClient(userAId);
    const clientB = createImpersonatedClient(userBId);

    // ── Test 1: User A can see their own patients ─────────────────
    console.log('\n🔒 Test Suite 1: Positive Access (Own Data)\n');

    const { data: ownPatients, error: ownError } = await clientA
        .from('patients')
        .select('id, first_name, clinic_id')
        .eq('clinic_id', clinicA.id);

    assert(
        'User A can read own clinic patients',
        !ownError && ownPatients !== null && ownPatients.length > 0,
        ownError ? `Error: ${ownError.message}` : `Found ${ownPatients?.length} patient(s)`
    );

    // ── Test 2: User A CANNOT see Clinic B's patients ─────────────
    console.log('\n🔒 Test Suite 2: Cross-Tenant Read Isolation\n');

    const { data: crossPatients, error: crossError } = await clientA
        .from('patients')
        .select('id, first_name, clinic_id')
        .eq('clinic_id', clinicB.id);

    assert(
        'User A CANNOT read Clinic B patients',
        (crossPatients === null || crossPatients.length === 0) && !crossError,
        crossError ? `Error: ${crossError.message}` : `Found ${crossPatients?.length || 0} patient(s) (expected 0)`
    );

    // ── Test 3: User A CANNOT update Clinic B's patients ──────────
    console.log('\n🔒 Test Suite 3: Cross-Tenant Write Isolation\n');

    const { error: crossUpdateError, count: updateCount } = await clientA
        .from('patients')
        .update({ first_name: 'HACKED' })
        .eq('id', patientB.id);

    assert(
        'User A CANNOT update Clinic B patient',
        updateCount === 0 || updateCount === null,
        `Update affected ${updateCount ?? 0} row(s) (expected 0). Error: ${crossUpdateError?.message || 'none'}`
    );

    // Verify patient B was NOT modified
    const { data: verifyB } = await adminClient.from('patients').select('first_name').eq('id', patientB.id).single();
    assert(
        'Clinic B patient data is intact after attack',
        verifyB?.first_name === 'Patient',
        `Name is: "${verifyB?.first_name}" (expected "Patient")`
    );

    // ── Test 4: User A CANNOT delete Clinic B's patients ──────────
    const { error: crossDeleteError, count: deleteCount } = await clientA
        .from('patients')
        .delete()
        .eq('id', patientB.id);

    assert(
        'User A CANNOT delete Clinic B patient',
        deleteCount === 0 || deleteCount === null,
        `Delete affected ${deleteCount ?? 0} row(s) (expected 0). Error: ${crossDeleteError?.message || 'none'}`
    );

    // ── Test 5: User A CANNOT insert into Clinic B ────────────────
    console.log('\n🔒 Test Suite 4: Cross-Tenant Insert Isolation\n');

    const { error: crossInsertError } = await clientA
        .from('patients')
        .insert({
            clinic_id: clinicB.id,
            first_name: 'Injected',
            last_name: 'Patient',
            phone: '+9999999999',
        });

    assert(
        'User A CANNOT insert patient into Clinic B',
        crossInsertError !== null,
        crossInsertError ? `Blocked: ${crossInsertError.message}` : 'INSERT was NOT blocked (FAIL)'
    );

    // ── Test 6: Service role CAN access all data ──────────────────
    console.log('\n🔒 Test Suite 5: Service Role Access\n');

    const { data: allPatients, error: adminError } = await adminClient
        .from('patients')
        .select('id')
        .in('clinic_id', [clinicA.id, clinicB.id]);

    assert(
        'Service role can read all clinics (for background workers)',
        !adminError && allPatients !== null && allPatients.length >= 2,
        adminError ? `Error: ${adminError.message}` : `Found ${allPatients?.length} patient(s) across both clinics`
    );

    // ── Cleanup ───────────────────────────────────────────────────
    await cleanup(clinicA.id, clinicB.id, userAId, userBId);

    // ── Summary ───────────────────────────────────────────────────
    console.log('\n══════════════════════════════════════════');
    console.log('  RESULTS SUMMARY');
    console.log('══════════════════════════════════════════\n');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    console.log(`  Total:  ${total}`);
    console.log(`  Passed: ${passed} ✅`);
    console.log(`  Failed: ${failed} ${failed > 0 ? '❌' : ''}`);
    console.log(`  Score:  ${Math.round((passed / total) * 100)}%`);
    console.log(`\n  Verdict: ${failed === 0 ? '✅ TENANT ISOLATION VERIFIED' : '❌ ISOLATION BREACH DETECTED'}`);
    console.log('\n══════════════════════════════════════════\n');

    if (failed > 0) {
        process.exit(1);
    }
}

async function cleanup(clinicAId: string, clinicBId: string, userAId: string, userBId: string) {
    console.log('\n🧹 Cleaning up test fixtures...');

    // Delete in reverse dependency order
    await adminClient.from('patients').delete().eq('clinic_id', clinicAId);
    await adminClient.from('patients').delete().eq('clinic_id', clinicBId);
    await adminClient.from('staff_memberships').delete().eq('clinic_id', clinicAId);
    await adminClient.from('staff_memberships').delete().eq('clinic_id', clinicBId);
    await adminClient.from('clinics').delete().eq('id', clinicAId);
    await adminClient.from('clinics').delete().eq('id', clinicBId);

    // Delete test auth users
    await adminClient.auth.admin.deleteUser(userAId);
    await adminClient.auth.admin.deleteUser(userBId);

    console.log('  ✅ Test fixtures cleaned up');
}

runTests().catch(err => {
    console.error('❌ Test runner failed:', err);
    process.exit(1);
});
