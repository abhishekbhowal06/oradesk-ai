import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Explicitly load .env from current directory
const envPath = path.resolve(__dirname, '../.env');
console.log(`📂 Loading .env from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('❌ Failed to load .env file', result.error);
}

async function verifyDb() {
  console.log('🩺 OPT LAZARUS: Health Check...');

  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

  if (!connectionString) {
    console.error('❌ FATAL: No DATABASE_URL found.');
    return;
  }

  // Redact password for logging
  try {
    const masked = connectionString.replace(/:([^:@]+)@/, ':****@');
    console.log(`🔌 Configured URL: ${masked}`);
  } catch (e) {
    console.log('🔌 Configured URL: (Failed to mask)');
  }

  try {
    console.log('🏗️ Creating Client...');
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });

    console.log('🔗 Connecting...');
    await client.connect();

    console.log('🔍 Querying clinics table...');
    const res = await client.query('SELECT count(*) FROM clinics');
    console.log(`✅ DATABASE HEALTHY. Clinics found. Count: ${res.rows[0].count}`);

    await client.end();
  } catch (err) {
    console.error('❌ CONNECTION ERROR:', err);
    // Print full error object
    console.error(JSON.stringify(err, null, 2));
  }
}

verifyDb().catch((e) => console.error('Unhandled:', e));
