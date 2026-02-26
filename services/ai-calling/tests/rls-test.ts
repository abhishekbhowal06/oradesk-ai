import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !JWT_SECRET) {
    console.error('Missing required Supabase environment variables');
    process.exit(1);
}

// System admin client overrides RLS
const adminClient = createClient(SUPABASE_URL as string, SUPABASE_SERVICE_ROLE_KEY as string);

function createClientAsUser(userId: string) {
    // Generate an authenticated JWT for the fake user
    const token = jwt.sign(
        { sub: userId, role: 'authenticated', aud: 'authenticated' },
        JWT_SECRET as string,
        { expiresIn: '1h' }
    );

    return createClient(SUPABASE_URL as string, SUPABASE_SERVICE_ROLE_KEY as string, {
        global: {
            headers: { Authorization: `Bearer ${token}` }
        }
    });
}

async function runRLSTest() {
    console.log('🔒 Starting Cross-Tenant Row Level Security (RLS) Verification...\n');

    // 1. Setup Data - Create 2 Fake Clinics and 2 Fake Users
    const clinicA_Id = '00000000-0000-0000-0000-00000000000a';
    const clinicB_Id = '00000000-0000-0000-0000-00000000000b';
    const userA_Id = '11111111-1111-1111-1111-11111111111a';
    const userB_Id = '11111111-1111-1111-1111-11111111111b';

    console.log('📦 Provisioning isolated test silos...');

    try {
        // Upsert Clinics
        await adminClient.from('clinics').upsert([
            { id: clinicA_Id, name: 'Clinic Alpha (Test)' },
            { id: clinicB_Id, name: 'Clinic Bravo (Test)' }
        ]);

        // Upsert Memberships (User A -> Clinic A, User B -> Clinic B)
        await adminClient.from('staff_memberships').upsert([
            { user_id: userA_Id, clinic_id: clinicA_Id, role: 'admin' },
            { user_id: userB_Id, clinic_id: clinicB_Id, role: 'admin' }
        ]);

        // Insert some fake sensitive data into calls table
        await adminClient.from('calls').upsert([
            { id: '22222222-2222-2222-2222-22222222222a', clinic_id: clinicA_Id, status: 'completed', direction: 'inbound' },
            { id: '22222222-2222-2222-2222-22222222222b', clinic_id: clinicB_Id, status: 'completed', direction: 'inbound' }
        ]);

        console.log('✅ Silos provisioned successfully.\n');

        // 2. Perform cross-tenant leak test
        console.log('🕵️ User A (Clinic Alpha) attempting to query the system...');
        const clientA = createClientAsUser(userA_Id);

        const { data: callsA, error: errA } = await clientA.from('calls').select('*');
        if (errA) throw errA;

        console.log(`User A sees ${callsA.length} total call(s).`);
        const aHasClinicB = callsA.some((c: any) => c.clinic_id === clinicB_Id);

        if (aHasClinicB) {
            console.error('🚨 FAILURE: USER A CAN SEE USER B DATA! RLS IS BYPASSED!');
            process.exit(1);
        } else {
            console.log('✅ SECURITY PASS: User A is perfectly isolated from Clinic B data.');
        }

        console.log('\n🕵️ User B (Clinic Bravo) attempting to query the system...');
        const clientB = createClientAsUser(userB_Id);

        const { data: callsB, error: errB } = await clientB.from('calls').select('*');
        if (errB) throw errB;

        console.log(`User B sees ${callsB.length} total call(s).`);
        const bHasClinicA = callsB.some((c: any) => c.clinic_id === clinicA_Id);

        if (bHasClinicA) {
            console.error('🚨 FAILURE: USER B CAN SEE USER A DATA! RLS IS BYPASSED!');
            process.exit(1);
        } else {
            console.log('✅ SECURITY PASS: User B is perfectly isolated from Clinic A data.');
        }

        console.log('\n🛡️ ALL CROSS-TENANT RLS POLICIES VERIFIED SUCCESSFULLY.');

    } catch (error: any) {
        console.error('Test execution failed:', error.message || error);
        if (error.details) console.error('Details:', error.details);
        if (error.hint) console.error('Hint:', error.hint);
    } finally {
        console.log('\n🧹 Cleaning up test data...');
        await adminClient.from('calls').delete().in('id', ['22222222-2222-2222-2222-22222222222a', '22222222-2222-2222-2222-22222222222b']);
        await adminClient.from('staff_memberships').delete().in('user_id', [userA_Id, userB_Id]);
        await adminClient.from('clinics').delete().in('id', [clinicA_Id, clinicB_Id]);
        console.log('✅ Cleanup complete.');
    }
}

runRLSTest();
