import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials in env');
}

// ─── ADMIN CLIENT ────────────────────────────────────────────────
// ONLY for server-side admin tasks: signup, cron jobs, background workers.
// NEVER use in user-facing request handlers.
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ─── READ-REPLICA CLIENT (ENTERPRISE SCALE) ──────────────────────
// Used for heavy SELECT queries in analytics/reporting to offload primary.
const SUPABASE_READ_URL = process.env.SUPABASE_READ_REPLICA_URL || SUPABASE_URL;
export const supabaseRead = createClient(SUPABASE_READ_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Creates a Supabase client that impersonates the calling user's JWT.
// All queries go through RLS with auth.uid() = the user's real identity.
export function createUserScopedClient(userJwt: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${userJwt}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Creates a user-scoped client pointing to the READ REPLICA.
 * Falls back to primary if no replica is configured.
 */
export function createUserScopedReadClient(userJwt: string): SupabaseClient {
  const readUrl = process.env.SUPABASE_READ_REPLICA_URL || SUPABASE_URL;
  return createClient(readUrl, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${userJwt}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ─── BACKWARD COMPATIBILITY (DEPRECATED) ─────────────────────────
// This is the legacy global client. All routes MUST migrate to
// createUserScopedClient(req) for RLS enforcement.  
// Keeping temporarily for background workers and webhook handlers
// that do NOT have a user context.
export const supabase = supabaseAdmin;
