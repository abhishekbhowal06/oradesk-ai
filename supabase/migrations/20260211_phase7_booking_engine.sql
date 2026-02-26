-- ============================================================================
-- DENTACORE OS - PHASE 7: CLOSED-LOOP BOOKING ENGINE
-- Migration: 20260211_phase7_booking_engine
-- Purpose: Create schema for atomic slot locking and PMS write-back tracking
-- ============================================================================

-- 1. Create Enums for Booking State Machine
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'slot_status') THEN
        CREATE TYPE public.slot_status AS ENUM ('available', 'locked', 'booked', 'unavailable');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'booking_status') THEN
        CREATE TYPE public.booking_status AS ENUM ('initiated', 'offer_sent', 'accepted', 'syncing', 'confirmed', 'failed');
    END IF;
END $$;

-- 2. Create PMS Slots Table (Cache & Lock Layer)
CREATE TABLE IF NOT EXISTS public.pms_slots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    provider_id VARCHAR(50) NOT NULL, -- Logical ID from PMS (e.g., 'DOC1', 'HYG2')
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status public.slot_status DEFAULT 'available',
    
    -- Locking Mechanism
    locked_until TIMESTAMPTZ, 
    locked_by_call_id UUID REFERENCES public.ai_calls(id) ON DELETE SET NULL,
    
    -- External PMS Reference
    pms_slot_id VARCHAR(100), -- ID from OpenDental/Dentrix if applicable
    
    -- Metadata
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_time_order CHECK (start_time < end_time),
    -- Ensure unique slots per provider to prevent duplication
    UNIQUE(clinic_id, provider_id, start_time)
);

-- 3. Create Booking Attempts Table (Audit Log)
CREATE TABLE IF NOT EXISTS public.booking_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    call_id UUID REFERENCES public.ai_calls(id) ON DELETE SET NULL,
    slot_id UUID REFERENCES public.pms_slots(id),
    patient_id UUID REFERENCES public.patients(id),
    
    -- State Machine
    status public.booking_status DEFAULT 'initiated',
    
    -- Outcome
    pms_appointment_id VARCHAR(100), -- The 'Golden Record' ID from OpenDental
    error_log TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE public.pms_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_attempts ENABLE ROW LEVEL SECURITY;

-- 5. Policies
-- pms_slots: Service role manages, members view
DROP POLICY IF EXISTS "Service role manages slots" ON public.pms_slots;
CREATE POLICY "Service role manages slots" ON public.pms_slots
    FOR ALL
    USING ( auth.role() = 'service_role' )
    WITH CHECK ( auth.role() = 'service_role' );

DROP POLICY IF EXISTS "Members view slots" ON public.pms_slots;
CREATE POLICY "Members view slots" ON public.pms_slots
    FOR SELECT
    USING ( public.is_clinic_member(clinic_id) );

-- booking_attempts: Service role manages, members view
DROP POLICY IF EXISTS "Service role manages bookings" ON public.booking_attempts;
CREATE POLICY "Service role manages bookings" ON public.booking_attempts
    FOR ALL
    USING ( auth.role() = 'service_role' )
    WITH CHECK ( auth.role() = 'service_role' );

DROP POLICY IF EXISTS "Members view bookings" ON public.booking_attempts;
CREATE POLICY "Members view bookings" ON public.booking_attempts
    FOR SELECT
    USING ( public.is_clinic_member(clinic_id) );

-- 6. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_pms_slots_clinic_time ON public.pms_slots(clinic_id, start_time);
CREATE INDEX IF NOT EXISTS idx_pms_slots_status ON public.pms_slots(status);
CREATE INDEX IF NOT EXISTS idx_booking_attempts_call_id ON public.booking_attempts(call_id);
CREATE INDEX IF NOT EXISTS idx_booking_attempts_patient_id ON public.booking_attempts(patient_id);

-- 7. Triggers for Updated At
DROP TRIGGER IF EXISTS update_booking_attempts_modtime ON public.booking_attempts;
CREATE TRIGGER update_booking_attempts_modtime
    BEFORE UPDATE ON public.booking_attempts
    FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();
