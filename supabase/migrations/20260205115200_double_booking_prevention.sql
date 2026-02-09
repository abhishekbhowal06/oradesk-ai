-- Migration: Add Double-Booking Prevention
-- Purpose: Prevent same patient from having overlapping appointments
-- Author: Dentacore OS Production Safety Execution
-- Date: 2026-02-05

-- Create unique partial index to prevent double-booking
-- A patient cannot have two appointments at the same time that aren't cancelled
CREATE UNIQUE INDEX IF NOT EXISTS idx_prevent_double_booking
    ON public.appointments (patient_id, scheduled_at)
    WHERE status NOT IN ('cancelled', 'no_show');

-- Add version column for optimistic locking
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Create trigger to auto-increment version on update
CREATE OR REPLACE FUNCTION public.increment_appointment_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_increment_appointment_version ON public.appointments;
CREATE TRIGGER trigger_increment_appointment_version
    BEFORE UPDATE ON public.appointments
    FOR EACH ROW
    EXECUTE FUNCTION public.increment_appointment_version();

-- Add comments
COMMENT ON INDEX idx_prevent_double_booking IS 'Prevents a patient from having multiple active appointments at the same time';
COMMENT ON COLUMN public.appointments.version IS 'Optimistic locking version for concurrent updates';
