import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

// Load env from current directory
dotenv.config();

async function applyMigration() {
  console.log('💉 OPT LAZARUS: Applying Migration...');

  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error('❌ FATAL: No DATABASE_URL or SUPABASE_DB_URL found in .env');
    process.exit(1);
  }

  // Path to migration file (relative to this script in services/ai-calling/scripts)
  // Script is in ./scripts, so we go ../../ to service root, then ../../ to workspace root??
  // Wait, running from services/ai-calling root.
  // Migration is in workspace_root/supabase/migrations
  // services/ai-calling is in workspace_root/services/ai-calling
  // So distinct path: ../../supabase/migrations/20260214_restore_core_schema.sql

  const migrationPath = path.resolve(
    __dirname,
    '../../../supabase/migrations/20260214_restore_core_schema.sql',
  );

  console.log(`📄 Reading migration file: ${migrationPath}`);

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found at ${migrationPath}`);
    // Fallback: try relative to CWD if running from service root
    // If CWD is services/ai-calling, then ../../supabase...
    const altPath = path.resolve(
      process.cwd(),
      '../../supabase/migrations/20260214_restore_core_schema.sql',
    );
    console.log(`   Trying alternate path: ${altPath}`);
    if (fs.existsSync(altPath)) {
      // use alt path
    } else {
      process.exit(1);
    }
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }, // Supabase requires SSL
  });

  try {
    await client.connect();
    console.log('🔌 Connected to Database.');

    console.log('🚀 Executing SQL...');
    await client.query(sql);

    console.log('✅ MIGRATION APPLIED SUCCESSFULLY.');
  } catch (err) {
    console.error('❌ MIGRATION FAILED:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigration();
