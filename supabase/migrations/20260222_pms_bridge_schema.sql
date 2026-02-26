-- ============================================================================
-- ORADESK AI — PMS BRIDGE INTEGRATION SCHEMA
-- ============================================================================
--
-- Architecture:
--   Desktop Agent → Cloud API → Supabase
--   Internal DB = Source of Truth (always)
--   PMS = Real-time data source (read), write-back target (appointments)
--
-- Security:
--   - Token-based device registration (one device per clinic)
--   - No raw PHI in logs (hashed identifiers only)
--   - Encrypted local cache on agent
--   - Full audit trail of every write operation
--   - RLS enforced for multi-clinic isolation
-- ============================================================================

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pms_provider') THEN
        CREATE TYPE public.pms_provider AS ENUM (
            'opendental',
            'dentrix',
            'eaglesoft',
            'curve_dental',
            'carestream',
            'generic_odbc'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bridge_device_status') THEN
        CREATE TYPE public.bridge_device_status AS ENUM (
            'pending_activation',   -- Registered but not yet verified
            'active',               -- Online and syncing
            'offline',              -- No heartbeat within TTL
            'suspended',            -- Admin suspended
            'revoked'               -- Security revocation
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pms_sync_direction') THEN
        CREATE TYPE public.pms_sync_direction AS ENUM (
            'pms_to_cloud',         -- READ: PMS → OraDesk
            'cloud_to_pms',         -- WRITE: OraDesk → PMS
            'bidirectional'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pms_write_operation') THEN
        CREATE TYPE public.pms_write_operation AS ENUM (
            'create_appointment',
            'update_appointment_status',
            'cancel_appointment'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pms_entity_type') THEN
        CREATE TYPE public.pms_entity_type AS ENUM (
            'patient',
            'appointment',
            'treatment_plan',
            'procedure',
            'balance',
            'insurance'
        );
    END IF;
END $$;

-- ============================================================================
-- 2. BRIDGE DEVICE REGISTRY
-- ============================================================================
-- One registered device per clinic. Token-based authentication.

CREATE TABLE IF NOT EXISTS public.bridge_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,

    -- Device Identity
    device_name TEXT NOT NULL DEFAULT 'OraDesk Bridge',
    device_fingerprint TEXT,            -- Machine-specific identifier (hashed)
    agent_version TEXT NOT NULL,

    -- PMS Connection
    pms_provider pms_provider NOT NULL,
    pms_version TEXT,                   -- e.g., 'OpenDental 23.2'
    pms_db_host TEXT DEFAULT 'localhost',
    pms_db_port INTEGER DEFAULT 3306,

    -- Authentication
    device_token_hash TEXT NOT NULL,    -- bcrypt hash of the device token
    activation_code TEXT,               -- 6-digit activation code (expires)
    activation_code_expiry TIMESTAMPTZ,

    -- Status & Health
    status bridge_device_status NOT NULL DEFAULT 'pending_activation',
    last_heartbeat_at TIMESTAMPTZ,
    heartbeat_interval_seconds INTEGER DEFAULT 60,
    consecutive_failures INTEGER DEFAULT 0,

    -- Sync Stats
    last_sync_at TIMESTAMPTZ,
    total_records_synced BIGINT DEFAULT 0,
    total_writes_executed BIGINT DEFAULT 0,

    -- Metadata
    registered_by UUID REFERENCES auth.users(id),
    registered_at TIMESTAMPTZ DEFAULT now(),
    suspended_at TIMESTAMPTZ,
    suspension_reason TEXT,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- One device per clinic
    UNIQUE(clinic_id)
);

-- ============================================================================
-- 3. PMS ENTITY MAPPING
-- ============================================================================
-- Maps PMS-specific IDs to OraDesk internal IDs.
-- Prevents duplicates on re-sync. Enables bidirectional lookups.

CREATE TABLE IF NOT EXISTS public.pms_entity_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.bridge_devices(id) ON DELETE SET NULL,

    -- Entity Reference
    entity_type pms_entity_type NOT NULL,
    pms_id TEXT NOT NULL,               -- ID in the PMS system (e.g., OpenDental PatNum)
    oradesk_id UUID NOT NULL,           -- ID in OraDesk (patients.id or appointments.id)

    -- Sync Metadata
    pms_checksum TEXT,                  -- Hash of PMS record for change detection
    last_synced_at TIMESTAMPTZ DEFAULT now(),
    sync_version INTEGER DEFAULT 1,     -- Incremented on each sync

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- One mapping per entity per clinic
    UNIQUE(clinic_id, entity_type, pms_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_map_oradesk
    ON public.pms_entity_map (oradesk_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_entity_map_pms
    ON public.pms_entity_map (clinic_id, entity_type, pms_id);

-- ============================================================================
-- 4. PMS WRITE QUEUE
-- ============================================================================
-- Commands from cloud to be executed by the bridge agent on the PMS.
-- Agent polls this table for pending writes.

CREATE TABLE IF NOT EXISTS public.pms_write_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.bridge_devices(id) ON DELETE SET NULL,

    -- Operation
    operation pms_write_operation NOT NULL,
    entity_type pms_entity_type NOT NULL DEFAULT 'appointment',
    oradesk_id UUID,                    -- The OraDesk record being written back
    pms_id TEXT,                        -- Target PMS record (for updates)

    -- Payload (encrypted, PII-safe)
    payload JSONB NOT NULL,             -- { scheduled_at, status, procedure_name, duration_minutes, ... }

    -- Execution State
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'claimed', 'executing', 'completed', 'failed', 'cancelled')),
    claimed_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    result JSONB,                       -- { pms_id: '...', success: true }

    -- Conflict handling
    conflict_detected BOOLEAN DEFAULT false,
    conflict_details JSONB,

    -- Audit
    requested_by TEXT DEFAULT 'system', -- 'system', 'ai', 'staff:{userId}'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_write_queue_pending
    ON public.pms_write_queue (clinic_id, status)
    WHERE status IN ('pending', 'claimed');

CREATE INDEX IF NOT EXISTS idx_write_queue_device
    ON public.pms_write_queue (device_id, status);

-- ============================================================================
-- 5. PMS SYNC AUDIT LOG
-- ============================================================================
-- Every read/write operation logged for HIPAA compliance.

CREATE TABLE IF NOT EXISTS public.pms_bridge_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.bridge_devices(id) ON DELETE SET NULL,

    -- Operation Details
    direction pms_sync_direction NOT NULL,
    entity_type pms_entity_type NOT NULL,
    operation TEXT NOT NULL,            -- 'read_batch', 'create', 'update', 'delete'
    record_count INTEGER DEFAULT 0,

    -- Identifiers (hashed for HIPAA, no raw PHI)
    pms_id_hash TEXT,                   -- SHA-256 of PMS ID
    oradesk_id UUID,

    -- Status
    status TEXT NOT NULL DEFAULT 'success'
        CHECK (status IN ('success', 'partial', 'failed', 'conflict')),
    error_message TEXT,

    -- Timing
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    -- Context
    agent_version TEXT,
    payload_summary JSONB,              -- { patients: 12, appointments: 8 } (counts only, no PHI)

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bridge_audit_clinic_time
    ON public.pms_bridge_audit_log (clinic_id, created_at DESC);

-- ============================================================================
-- 6. PMS FIELD MAPPING CONFIG
-- ============================================================================
-- Configurable mapping from PMS columns to OraDesk fields.
-- Allows customization per PMS provider without code changes.

CREATE TABLE IF NOT EXISTS public.pms_field_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pms_provider pms_provider NOT NULL,
    entity_type pms_entity_type NOT NULL,

    -- Source (PMS side)
    pms_table TEXT NOT NULL,
    pms_column TEXT NOT NULL,
    pms_id_column TEXT NOT NULL,        -- Primary key column in PMS

    -- Target (OraDesk side)
    oradesk_table TEXT NOT NULL,
    oradesk_column TEXT NOT NULL,

    -- Transform
    transform_type TEXT DEFAULT 'direct' -- 'direct', 'map', 'concat', 'date_format'
        CHECK (transform_type IN ('direct', 'map', 'concat', 'date_format', 'custom')),
    transform_config JSONB,             -- { map: { 1: 'scheduled', 2: 'completed' } }

    -- Metadata
    is_active BOOLEAN DEFAULT true,
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(pms_provider, entity_type, pms_column, oradesk_column)
);

-- ============================================================================
-- 7. SEED OPENDENTAL FIELD MAPPINGS
-- ============================================================================

INSERT INTO public.pms_field_mappings (pms_provider, entity_type, pms_table, pms_column, pms_id_column, oradesk_table, oradesk_column, transform_type, transform_config)
VALUES
    -- Patient mappings
    ('opendental', 'patient', 'patient', 'PatNum', 'PatNum', 'patients', 'id', 'direct', NULL),
    ('opendental', 'patient', 'patient', 'LName', 'PatNum', 'patients', 'last_name', 'direct', NULL),
    ('opendental', 'patient', 'patient', 'FName', 'PatNum', 'patients', 'first_name', 'direct', NULL),
    ('opendental', 'patient', 'patient', 'HmPhone', 'PatNum', 'patients', 'phone', 'direct', NULL),
    ('opendental', 'patient', 'patient', 'Email', 'PatNum', 'patients', 'email', 'direct', NULL),
    ('opendental', 'patient', 'patient', 'Birthdate', 'PatNum', 'patients', 'date_of_birth', 'date_format', '{"format": "YYYY-MM-DD"}'),
    ('opendental', 'patient', 'patient', 'PatStatus', 'PatNum', 'patients', 'status', 'map', '{"0": "active", "1": "inactive", "2": "archived", "3": "deceased"}'),

    -- Appointment mappings
    ('opendental', 'appointment', 'appointment', 'AptNum', 'AptNum', 'appointments', 'id', 'direct', NULL),
    ('opendental', 'appointment', 'appointment', 'PatNum', 'AptNum', 'appointments', 'patient_id', 'direct', NULL),
    ('opendental', 'appointment', 'appointment', 'AptDateTime', 'AptNum', 'appointments', 'scheduled_at', 'date_format', '{"format": "ISO8601"}'),
    ('opendental', 'appointment', 'appointment', 'Pattern', 'AptNum', 'appointments', 'duration_minutes', 'custom', '{"rule": "count_x_multiply_5"}'),
    ('opendental', 'appointment', 'appointment', 'ProcDescript', 'AptNum', 'appointments', 'procedure_name', 'direct', NULL),
    ('opendental', 'appointment', 'appointment', 'AptStatus', 'AptNum', 'appointments', 'status', 'map', '{"1": "scheduled", "2": "completed", "3": "scheduled", "5": "cancelled", "6": "missed"}'),
    ('opendental', 'appointment', 'appointment', 'Confirmed', 'AptNum', 'appointments', 'confirmed_status', 'map', '{"0": "unconfirmed", "1": "confirmed", "2": "not_called"}'),

    -- Treatment Plan mappings
    ('opendental', 'treatment_plan', 'treatplan', 'TreatPlanNum', 'TreatPlanNum', 'treatment_plans', 'id', 'direct', NULL),
    ('opendental', 'treatment_plan', 'treatplan', 'PatNum', 'TreatPlanNum', 'treatment_plans', 'patient_id', 'direct', NULL),
    ('opendental', 'treatment_plan', 'treatplan', 'Heading', 'TreatPlanNum', 'treatment_plans', 'name', 'direct', NULL),
    ('opendental', 'treatment_plan', 'treatplan', 'DateTP', 'TreatPlanNum', 'treatment_plans', 'created_at', 'date_format', '{"format": "ISO8601"}'),

    -- Procedure Log (for balance/revenue)
    ('opendental', 'procedure', 'procedurelog', 'ProcNum', 'ProcNum', 'procedure_logs', 'id', 'direct', NULL),
    ('opendental', 'procedure', 'procedurelog', 'PatNum', 'ProcNum', 'procedure_logs', 'patient_id', 'direct', NULL),
    ('opendental', 'procedure', 'procedurelog', 'ProcFee', 'ProcNum', 'procedure_logs', 'fee', 'direct', NULL),
    ('opendental', 'procedure', 'procedurelog', 'ProcDate', 'ProcNum', 'procedure_logs', 'procedure_date', 'date_format', '{"format": "ISO8601"}'),
    ('opendental', 'procedure', 'procedurelog', 'ProcStatus', 'ProcNum', 'procedure_logs', 'status', 'map', '{"1": "treatment_planned", "2": "completed", "6": "referred"}'),

    -- Balance (from claimproc)
    ('opendental', 'balance', 'claimproc', 'ClaimProcNum', 'ClaimProcNum', 'claim_records', 'id', 'direct', NULL),
    ('opendental', 'balance', 'claimproc', 'PatNum', 'ClaimProcNum', 'claim_records', 'patient_id', 'direct', NULL),
    ('opendental', 'balance', 'claimproc', 'InsPayAmt', 'ClaimProcNum', 'claim_records', 'insurance_paid', 'direct', NULL),
    ('opendental', 'balance', 'claimproc', 'WriteOff', 'ClaimProcNum', 'claim_records', 'write_off', 'direct', NULL)
ON CONFLICT (pms_provider, entity_type, pms_column, oradesk_column) DO NOTHING;

-- ============================================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.bridge_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pms_entity_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pms_write_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pms_bridge_audit_log ENABLE ROW LEVEL SECURITY;

-- Bridge devices: admin-only management, system-level for agent heartbeats
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'bridge_devices_clinic_access') THEN
        CREATE POLICY bridge_devices_clinic_access ON public.bridge_devices
            FOR ALL USING (
                clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
            );
    END IF;
END $$;

-- Entity map: system-level (bridge agent operates with service role)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pms_entity_map_system') THEN
        CREATE POLICY pms_entity_map_system ON public.pms_entity_map
            FOR ALL USING (true);
    END IF;
END $$;

-- Write queue: clinic isolation
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pms_write_queue_clinic') THEN
        CREATE POLICY pms_write_queue_clinic ON public.pms_write_queue
            FOR ALL USING (
                clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
            );
    END IF;
END $$;

-- Audit log: clinic members read, system writes
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pms_audit_log_read') THEN
        CREATE POLICY pms_audit_log_read ON public.pms_bridge_audit_log
            FOR SELECT USING (
                clinic_id IN (SELECT clinic_id FROM public.profiles WHERE id = auth.uid())
            );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pms_audit_log_write') THEN
        CREATE POLICY pms_audit_log_write ON public.pms_bridge_audit_log
            FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- ============================================================================
-- 9. AUTO-UPDATE TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_pms_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bridge_devices_updated ON public.bridge_devices;
CREATE TRIGGER trg_bridge_devices_updated
    BEFORE UPDATE ON public.bridge_devices
    FOR EACH ROW EXECUTE FUNCTION update_pms_timestamp();

DROP TRIGGER IF EXISTS trg_entity_map_updated ON public.pms_entity_map;
CREATE TRIGGER trg_entity_map_updated
    BEFORE UPDATE ON public.pms_entity_map
    FOR EACH ROW EXECUTE FUNCTION update_pms_timestamp();

DROP TRIGGER IF EXISTS trg_write_queue_updated ON public.pms_write_queue;
CREATE TRIGGER trg_write_queue_updated
    BEFORE UPDATE ON public.pms_write_queue
    FOR EACH ROW EXECUTE FUNCTION update_pms_timestamp();
