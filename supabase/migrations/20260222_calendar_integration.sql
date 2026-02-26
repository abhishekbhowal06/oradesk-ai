-- ============================================================================
-- ORADESK AI — EXTERNAL CALENDAR INTEGRATION SCHEMA
-- ============================================================================
-- 
-- Architecture:
--   Internal DB = Source of Truth (always)
--   External calendars = mirrors, never authoritative
--
-- Security:
--   - OAuth tokens stored encrypted (pgcrypto AES-256)
--   - RLS enforced per clinic_id
--   - Audit log for all sync operations
--   - Token rotation tracked
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'calendar_provider') THEN
        CREATE TYPE public.calendar_provider AS ENUM (
            'google_calendar',
            'microsoft_outlook',
            'apple_calendar'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'calendar_sync_status') THEN
        CREATE TYPE public.calendar_sync_status AS ENUM (
            'synced',           -- Successfully pushed/pulled
            'pending_push',     -- Created locally, not yet pushed
            'pending_pull',     -- Received from webhook, not yet processed
            'conflict',         -- Time overlap detected
            'failed',           -- Sync attempt failed
            'orphaned'          -- External event deleted, local still exists
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'calendar_connection_status') THEN
        CREATE TYPE public.calendar_connection_status AS ENUM (
            'active',
            'expired',          -- Token expired, needs re-auth
            'revoked',          -- User revoked access
            'disconnected'      -- Manually disconnected by admin
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sync_direction') THEN
        CREATE TYPE public.sync_direction AS ENUM (
            'push',             -- Internal → External
            'pull',             -- External → Internal
            'bidirectional'     -- Full 2-way
        );
    END IF;
END $$;

-- ============================================================================
-- 2. CLINIC CALENDAR CONNECTIONS
-- ============================================================================
-- One connection per clinic per provider. Stores encrypted OAuth tokens.

CREATE TABLE IF NOT EXISTS public.clinic_calendar_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,

    -- Provider & Identity
    provider calendar_provider NOT NULL,
    provider_account_email TEXT,            -- e.g., clinic@gmail.com
    provider_calendar_id TEXT DEFAULT 'primary', -- Which calendar to sync

    -- OAuth Tokens (encrypted at rest)
    -- Stored as encrypted bytea using pgcrypto symmetric encryption
    access_token_encrypted BYTEA NOT NULL,
    refresh_token_encrypted BYTEA NOT NULL,
    token_expiry TIMESTAMPTZ,

    -- Webhook Channel (for push notifications)
    webhook_channel_id TEXT,                -- Google Channel ID
    webhook_resource_id TEXT,               -- Google Resource ID
    webhook_expiry TIMESTAMPTZ,             -- Channel expiration

    -- Sync Configuration
    sync_direction sync_direction NOT NULL DEFAULT 'bidirectional',
    sync_enabled BOOLEAN NOT NULL DEFAULT true,
    auto_confirm_external BOOLEAN DEFAULT false, -- Auto-confirm externally created appts

    -- Status
    status calendar_connection_status NOT NULL DEFAULT 'active',
    last_synced_at TIMESTAMPTZ,
    last_sync_error TEXT,
    consecutive_failures INTEGER DEFAULT 0,

    -- Setup metadata
    connected_by UUID REFERENCES auth.users(id),
    connected_at TIMESTAMPTZ DEFAULT now(),
    disconnected_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- One connection per clinic per provider
    UNIQUE(clinic_id, provider)
);

-- ============================================================================
-- 3. APPOINTMENT EXTERNAL SYNC COLUMNS
-- ============================================================================
-- Extend the existing appointments table with sync metadata.

DO $$
BEGIN
    -- External event ID from the calendar provider
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'appointments' AND column_name = 'external_event_id'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN external_event_id TEXT;
    END IF;

    -- Which provider this syncs to
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'appointments' AND column_name = 'external_provider'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN external_provider calendar_provider;
    END IF;

    -- Sync status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'appointments' AND column_name = 'sync_status'
    ) THEN
        ALTER TABLE public.appointments
            ADD COLUMN sync_status calendar_sync_status DEFAULT 'pending_push';
    END IF;

    -- Last sync timestamp
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'appointments' AND column_name = 'last_synced_at'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN last_synced_at TIMESTAMPTZ;
    END IF;

    -- External sync hash (to detect external modifications)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'appointments' AND column_name = 'external_etag'
    ) THEN
        ALTER TABLE public.appointments ADD COLUMN external_etag TEXT;
    END IF;
END $$;

-- Index for fast sync lookups
CREATE INDEX IF NOT EXISTS idx_appointments_external_event
    ON public.appointments (external_event_id, external_provider)
    WHERE external_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_sync_status
    ON public.appointments (sync_status)
    WHERE sync_status IN ('pending_push', 'pending_pull', 'conflict');

-- ============================================================================
-- 4. CALENDAR SYNC LOG (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.calendar_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES public.clinic_calendar_connections(id) ON DELETE SET NULL,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,

    -- Operation
    direction sync_direction NOT NULL,
    operation TEXT NOT NULL,                 -- 'create', 'update', 'delete', 'conflict_resolve'
    status TEXT NOT NULL DEFAULT 'success',  -- 'success', 'failed', 'conflict'

    -- Details
    external_event_id TEXT,
    payload JSONB,                           -- Request/response snapshot (PII redacted)
    error_message TEXT,
    conflict_details JSONB,                  -- If conflict: { internal: {...}, external: {...} }

    -- Timing
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_log_clinic_time
    ON public.calendar_sync_log (clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_log_appointment
    ON public.calendar_sync_log (appointment_id)
    WHERE appointment_id IS NOT NULL;

-- ============================================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.clinic_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_sync_log ENABLE ROW LEVEL SECURITY;

-- Connections: clinic members only
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'clinic_calendar_connections_clinic_isolation'
    ) THEN
        CREATE POLICY clinic_calendar_connections_clinic_isolation
            ON public.clinic_calendar_connections
            FOR ALL
            USING (
                clinic_id IN (
                    SELECT clinic_id FROM public.profiles
                    WHERE id = auth.uid()
                )
            );
    END IF;
END $$;

-- Sync log: clinic members only
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'calendar_sync_log_clinic_isolation'
    ) THEN
        CREATE POLICY calendar_sync_log_clinic_isolation
            ON public.calendar_sync_log
            FOR ALL
            USING (
                clinic_id IN (
                    SELECT clinic_id FROM public.profiles
                    WHERE id = auth.uid()
                )
            );
    END IF;
END $$;

-- ============================================================================
-- 6. HELPER FUNCTIONS
-- ============================================================================

-- Encrypted token storage/retrieval helpers
-- The encryption key is stored in Vault/env, passed as parameter

CREATE OR REPLACE FUNCTION encrypt_token(plain_token TEXT, encryption_key TEXT)
RETURNS BYTEA AS $$
BEGIN
    RETURN pgp_sym_encrypt(plain_token, encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_token(encrypted_token BYTEA, encryption_key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(encrypted_token, encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conflict detection: check if time range overlaps existing appointments
CREATE OR REPLACE FUNCTION check_appointment_conflict(
    p_clinic_id UUID,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_exclude_appointment_id UUID DEFAULT NULL
)
RETURNS TABLE (
    conflict_id UUID,
    conflict_patient TEXT,
    conflict_procedure TEXT,
    conflict_start TIMESTAMPTZ,
    conflict_end TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        p.first_name || ' ' || p.last_name,
        a.procedure_name,
        a.scheduled_at::TIMESTAMPTZ,
        (a.scheduled_at + (a.duration_minutes || ' minutes')::INTERVAL)::TIMESTAMPTZ
    FROM public.appointments a
    JOIN public.patients p ON p.id = a.patient_id
    WHERE a.clinic_id = p_clinic_id
      AND a.status NOT IN ('cancelled', 'missed')
      AND (p_exclude_appointment_id IS NULL OR a.id != p_exclude_appointment_id)
      AND a.scheduled_at < p_end_time
      AND (a.scheduled_at + (a.duration_minutes || ' minutes')::INTERVAL) > p_start_time;
END;
$$ LANGUAGE plpgsql STABLE;

-- Dynamic availability: return open slots for a given date
CREATE OR REPLACE FUNCTION get_available_slots(
    p_clinic_id UUID,
    p_date DATE,
    p_duration_minutes INTEGER DEFAULT 30,
    p_start_hour INTEGER DEFAULT 8,
    p_end_hour INTEGER DEFAULT 17
)
RETURNS TABLE (
    slot_start TIMESTAMPTZ,
    slot_end TIMESTAMPTZ
) AS $$
DECLARE
    v_slot_start TIMESTAMPTZ;
    v_slot_end TIMESTAMPTZ;
    v_day_start TIMESTAMPTZ;
    v_day_end TIMESTAMPTZ;
BEGIN
    v_day_start := (p_date || ' ' || LPAD(p_start_hour::TEXT, 2, '0') || ':00:00')::TIMESTAMPTZ;
    v_day_end := (p_date || ' ' || LPAD(p_end_hour::TEXT, 2, '0') || ':00:00')::TIMESTAMPTZ;

    v_slot_start := v_day_start;

    WHILE v_slot_start + (p_duration_minutes || ' minutes')::INTERVAL <= v_day_end LOOP
        v_slot_end := v_slot_start + (p_duration_minutes || ' minutes')::INTERVAL;

        -- Check if this slot has any conflicts
        IF NOT EXISTS (
            SELECT 1 FROM check_appointment_conflict(p_clinic_id, v_slot_start, v_slot_end)
        ) THEN
            slot_start := v_slot_start;
            slot_end := v_slot_end;
            RETURN NEXT;
        END IF;

        v_slot_start := v_slot_start + INTERVAL '15 minutes'; -- 15-min granularity
    END LOOP;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

-- Auto-update updated_at on connections
CREATE OR REPLACE FUNCTION update_calendar_connection_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calendar_connection_updated ON public.clinic_calendar_connections;
CREATE TRIGGER trg_calendar_connection_updated
    BEFORE UPDATE ON public.clinic_calendar_connections
    FOR EACH ROW EXECUTE FUNCTION update_calendar_connection_timestamp();
