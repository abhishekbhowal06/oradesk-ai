-- Migration: Enterprise Scalability Indexes
-- Purpose: Support fast querying at 2M+ rows (200+ clinics) without sequential scans
-- Resolves: Phase 3 Database Stress Simulation (CTO Enterprise Audit)

-- 1. Patients lookup scale (for Widget and Recall)
-- Critical for avoiding slow lookups during patient matching
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_clinic_phone 
ON public.patients (clinic_id, phone);

-- 2. Appointments scale (for Calendar and Analytics)
-- Orders by scheduled_at to quickly paginate upcoming/past appointments
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_clinic_status_date 
ON public.appointments (clinic_id, status, scheduled_at DESC);

-- 3. Patient Name lookup (for Auto-suggest and search)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_clinic_lastname 
ON public.patients (clinic_id, last_name, first_name);

-- Note: Because we use CONCURRENTLY, this migration cannot run inside a transaction block.
-- If applying via an automated tool that wraps migrations in BEGIN/COMMIT, 
-- you may need to disable transactions just for this file.
