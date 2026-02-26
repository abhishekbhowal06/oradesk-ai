require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Testing DB Access...');
console.log('URL:', SUPABASE_URL);
console.log('Key Role:', require('jsonwebtoken').decode(SUPABASE_SERVICE_KEY).role);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function test() {
  console.log('Querying clinics...');
  const { count, error, data } = await supabase
    .from('clinics')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('❌ Query Failed:', JSON.stringify(error, null, 2));
  } else {
    console.log('✅ Query Succeeded. Count:', count);
  }

  console.log('Attempting Insert (rollback immediately)...');
  const { data: inserted, error: insertError } = await supabase
    .from('clinics')
    .insert({
      name: 'Test DB Script Clinic',
      email: 'test-db@example.com',
      subscription_tier: 'starter',
      subscription_status: 'trialing',
    })
    .select()
    .single();

  if (insertError) {
    console.error('❌ Insert Failed:', JSON.stringify(insertError, null, 2));
  } else {
    console.log('✅ Insert Succeeded:', inserted.id);
    // Cleanup
    await supabase.from('clinics').delete().eq('id', inserted.id);
    console.log('✅ Cleanup Succeeded');
  }
}

test();
