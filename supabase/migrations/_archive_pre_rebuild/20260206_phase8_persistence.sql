-- PG-BOSS SCHEMA SETUP
-- pg-boss will create its own tables, but we need to ensure the schema exists

CREATE SCHEMA IF NOT EXISTS pgboss;

-- GRANT permissions to the service role (adjust as needed for your setup)
-- GRANT ALL ON SCHEMA pgboss TO postgres;
-- GRANT ALL ON ALL TABLES IN SCHEMA pgboss TO postgres;

-- ============================================================================
-- ROW-LEVEL LOCKING FOR APPOINTMENT CLAIMING
-- Prevents race conditions when multiple callers attempt to claim the same slot
-- ============================================================================

-- Add column to track if appointment is being processed
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS processing_lock_id TEXT DEFAULT NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS processing_locked_at TIMESTAMPTZ DEFAULT NULL;

-- Index for faster lock cleanup
CREATE INDEX IF NOT EXISTS idx_appointments_processing_lock 
    ON appointments(processing_locked_at) 
    WHERE processing_lock_id IS NOT NULL;

-- Function to claim an appointment with row-level locking
-- Returns the claimed appointment or NULL if already claimed
CREATE OR REPLACE FUNCTION claim_appointment_slot(
    p_appointment_id UUID,
    p_lock_id TEXT,
    p_lock_timeout_seconds INTEGER DEFAULT 300 -- 5 minute timeout
)
RETURNS TABLE (
    id UUID,
    patient_id UUID,
    scheduled_at TIMESTAMPTZ,
    already_claimed BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_lock_expiry TIMESTAMPTZ := NOW() - (p_lock_timeout_seconds || ' seconds')::INTERVAL;
BEGIN
    -- Try to claim the slot using FOR UPDATE SKIP LOCKED
    RETURN QUERY
    WITH claimed AS (
        UPDATE appointments apt
        SET 
            processing_lock_id = p_lock_id,
            processing_locked_at = NOW()
        WHERE apt.id = p_appointment_id
          AND (
              apt.processing_lock_id IS NULL 
              OR apt.processing_locked_at < v_lock_expiry
          )
        RETURNING apt.id, apt.patient_id, apt.scheduled_at
    )
    SELECT 
        COALESCE(c.id, a.id) as id,
        COALESCE(c.patient_id, a.patient_id) as patient_id,
        COALESCE(c.scheduled_at, a.scheduled_at) as scheduled_at,
        (c.id IS NULL) as already_claimed
    FROM appointments a
    LEFT JOIN claimed c ON c.id = a.id
    WHERE a.id = p_appointment_id;
END;
$$;

-- Function to release a claimed appointment
CREATE OR REPLACE FUNCTION release_appointment_claim(
    p_appointment_id UUID,
    p_lock_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE appointments
    SET 
        processing_lock_id = NULL,
        processing_locked_at = NULL
    WHERE id = p_appointment_id
      AND processing_lock_id = p_lock_id;
    
    RETURN FOUND;
END;
$$;

-- Function to claim a gap/slot (used by cancellation prevention)
-- Uses SELECT FOR UPDATE SKIP LOCKED pattern
CREATE OR REPLACE FUNCTION claim_schedule_gap(
    p_clinic_id UUID,
    p_scheduled_at TIMESTAMPTZ,
    p_lock_id TEXT
)
RETURNS TABLE (
    appointment_id UUID,
    claimed BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH target AS (
        SELECT id
        FROM appointments
        WHERE clinic_id = p_clinic_id
          AND scheduled_at = p_scheduled_at
          AND status = 'cancelled'
          AND (processing_lock_id IS NULL OR processing_locked_at < NOW() - INTERVAL '5 minutes')
        FOR UPDATE SKIP LOCKED
        LIMIT 1
    ),
    claimed AS (
        UPDATE appointments a
        SET 
            processing_lock_id = p_lock_id,
            processing_locked_at = NOW()
        FROM target t
        WHERE a.id = t.id
        RETURNING a.id
    )
    SELECT 
        c.id as appointment_id,
        TRUE as claimed
    FROM claimed c
    UNION ALL
    SELECT 
        NULL::UUID as appointment_id,
        FALSE as claimed
    WHERE NOT EXISTS (SELECT 1 FROM claimed);
END;
$$;

-- ============================================================================
-- MULTI-TENANT RLS POLICIES AUDIT
-- Ensure strict tenant isolation
-- ============================================================================

-- Enable RLS on critical tables if not already enabled
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE autonomous_actions ENABLE ROW LEVEL SECURITY;

-- Policy: Clinics can only see their own appointments
DROP POLICY IF EXISTS appointments_tenant_isolation ON appointments;
CREATE POLICY appointments_tenant_isolation ON appointments
    FOR ALL
    USING (clinic_id = current_setting('app.current_clinic_id', true)::UUID)
    WITH CHECK (clinic_id = current_setting('app.current_clinic_id', true)::UUID);

-- Policy: Clinics can only see their own patients
DROP POLICY IF EXISTS patients_tenant_isolation ON patients;
CREATE POLICY patients_tenant_isolation ON patients
    FOR ALL
    USING (clinic_id = current_setting('app.current_clinic_id', true)::UUID)
    WITH CHECK (clinic_id = current_setting('app.current_clinic_id', true)::UUID);

-- Policy: Clinics can only see their own AI calls
DROP POLICY IF EXISTS ai_calls_tenant_isolation ON ai_calls;
CREATE POLICY ai_calls_tenant_isolation ON ai_calls
    FOR ALL
    USING (clinic_id = current_setting('app.current_clinic_id', true)::UUID)
    WITH CHECK (clinic_id = current_setting('app.current_clinic_id', true)::UUID);

-- Policy: Clinics can only see their own autonomous actions
DROP POLICY IF EXISTS autonomous_actions_tenant_isolation ON autonomous_actions;
CREATE POLICY autonomous_actions_tenant_isolation ON autonomous_actions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM appointments a 
            WHERE a.id = autonomous_actions.appointment_id 
              AND a.clinic_id = current_setting('app.current_clinic_id', true)::UUID
        )
        OR
        EXISTS (
            SELECT 1 FROM patients p 
            WHERE p.id = autonomous_actions.patient_id 
              AND p.clinic_id = current_setting('app.current_clinic_id', true)::UUID
        )
    );

-- Service role bypass (for background jobs)
-- The service role should bypass RLS for autonomous operations
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;
ALTER TABLE patients FORCE ROW LEVEL SECURITY;
ALTER TABLE ai_calls FORCE ROW LEVEL SECURITY;


-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION claim_appointment_slot IS 'Atomically claim an appointment slot with row-level locking to prevent race conditions';
COMMENT ON FUNCTION release_appointment_claim IS 'Release a previously claimed appointment slot';
COMMENT ON FUNCTION claim_schedule_gap IS 'Claim a cancelled slot for rebooking using SKIP LOCKED pattern';
