-- Migration: Optimistic Locking for Appointments
-- Required for high-concurrency environments (200+ clinics)

-- 1. Add version column to appointments table
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- 2. Create trigger to auto-increment version on every update
CREATE OR REPLACE FUNCTION increment_appointment_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_appointment_version ON public.appointments;
CREATE TRIGGER trg_increment_appointment_version
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION increment_appointment_version();

-- 3. Document usage
COMMENT ON COLUMN public.appointments.version IS 'Used for optimistic locking. Clients must pass expected version when updating to prevent lost updates during concurrent edits.';
