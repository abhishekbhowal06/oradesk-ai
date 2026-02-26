require('dotenv').config();
const jwt = require('jsonwebtoken');

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!serviceKey) {
  console.log('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

try {
  const decodedService = jwt.decode(serviceKey);
  console.log('🔑 Service Key Role:', decodedService.role);
  if (decodedService.role !== 'service_role') {
    console.error(
      '❌ CRITICAL: SUPABASE_SERVICE_ROLE_KEY has role',
      decodedService.role,
      '(expected service_role)',
    );
  } else {
    console.log('✅ Service Key looks correct.');
  }
} catch (e) {
  console.error('❌ Failed to decode Service Key', e.message);
}

if (anonKey) {
  try {
    const decodedAnon = jwt.decode(anonKey);
    console.log('🔑 Anon Key Role:', decodedAnon.role);
  } catch (e) {
    console.error('❌ Failed to decode Anon Key');
  }
}
