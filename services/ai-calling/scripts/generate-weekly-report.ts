import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env from service dir
dotenv.config({ path: path.join(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL || 'mock-url';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-key';

let supabase: any;
try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
    // ignore
}

async function generateReport() {
    console.log("------------------------------------------------");
    console.log("   DENTACORE WEEKLY REVENUE REPORT");
    console.log("------------------------------------------------");

    // Get all clinics
    let clinics: { id: string, name: string }[] = [];

    // Try Fetching Real Data with timeout/fallback
    let useMock = false;

    if (SUPABASE_URL === 'mock-url') {
        useMock = true;
    } else {
        try {
            const { data, error } = await supabase.from('clinics').select('id, name');
            if (error) throw error;
            clinics = data || [];
        } catch (e) {
            useMock = true;
        }
    }

    if (useMock) {
        console.log("  [!] Failed to connect to Supabase (Missing/Invalid Keys).");
        console.log("  [i] SWITCHING TO DEMO SIMULATION MODE");
        clinics = [
            { id: 'demo-1', name: 'Downtown Dental (Demo)' },
            { id: 'demo-2', name: 'Smile Studio (Demo)' }
        ];
    }

    for (const clinic of clinics) {
        console.log(`\nCLINIC: ${clinic.name.toUpperCase()}`);

        let calls = 0;
        let rev = 0;
        let bookings = 0;
        let projected = 0;

        if (useMock || clinic.id.startsWith('demo')) {
            // Mock Data Simulation
            calls = Math.floor(Math.random() * 500) + 100;
            bookings = Math.floor(calls * 0.15); // 15% conversion
            rev = bookings * 150;
            projected = rev * 12;
        } else {
            // Real Data Fetch
            const { data: stats, error } = await supabase
                .from('revenue_dashboard')
                .select('*')
                .eq('clinic_id', clinic.id)
                .single();

            if (!error && stats) {
                rev = stats.revenue_secured_30d || 0;
                projected = stats.projected_annual_value || 0;
                calls = stats.total_calls_30d || 0;
                bookings = stats.recall_bookings_30d || 0;
            }
        }

        console.log(`  > Calls Made (30d):       ${calls}`);
        console.log(`  > Recalls Booked:         ${bookings}`);
        console.log(`  > REVENUE SECURED:        $${rev.toLocaleString()}`);
        console.log(`  > PROJECTED ANNUAL VALUE: $${projected.toLocaleString()}`);
        console.log("------------------------------------------------");
    }
}

generateReport().catch(console.error);
