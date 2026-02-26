-- Migration: Fix Widget Patient Upsert Race Condition
-- Required for high-concurrency widget environments
-- Solves the non-atomic SELECT then INSERT/UPDATE pattern

-- 1. Ensure phone uniqueness per clinic to support ON CONFLICT upserts
-- Note: This requires resolving any existing duplicates first, but assume new DB for 200-clinic deployment.
ALTER TABLE public.patients DROP CONSTRAINT IF EXISTS unique_clinic_phone;
ALTER TABLE public.patients ADD CONSTRAINT unique_clinic_phone UNIQUE (clinic_id, phone);

-- 2. No changes required to appointments here, handled in the other script.
