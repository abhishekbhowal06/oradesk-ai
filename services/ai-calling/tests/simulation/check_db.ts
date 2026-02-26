
import { supabase } from '../../src/lib/supabase';

async function testDatabase() {
    console.log('📖 Checking AI Diary (follow_up_schedules table)...');

    // Try to insert a dummy record (it will fail on foreign keys likely, but that proves table exists)
    // Or just SELECT count

    const { count, error } = await supabase
        .from('follow_up_schedules')
        .select('*', { count: 'exact', head: true });

    if (error) {
        if (error.code === '42P01') {
            console.error('❌ Table Abhi Bhi Nahi Milli! (Relation does not exist)');
        } else {
            console.error('❌ Kuch aur error hai:', error.message);
            // If error is about permissions or column, table exists at least
            console.log('✅ Table Exists (but maybe empty or permission issue, which is fine for now)');
        }
    } else {
        console.log(`✅ Success! Table mil gayi. Total entries: ${count}`);
    }
}

testDatabase();
