-- ═══════════════════════════════════════════════════════════════
-- ENTERPRISE SCALE INDEXES
-- Required for 200+ clinic deployment (2M+ patients, 8M+ appointments)
-- Run with: CONCURRENTLY flag prevents table locks
-- ═══════════════════════════════════════════════════════════════

-- Patient lookup by phone (widget, call service, dedup)
-- Without this: sequential scan on 2M rows
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_clinic_phone
  ON patients(clinic_id, phone);

-- Patient search by name (patient list, search)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_clinic_name
  ON patients(clinic_id, last_name, first_name);

-- Appointment queries (dashboard, scheduling, calendar)
-- Without this: sequential scan on 8M rows
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_clinic_status_date
  ON appointments(clinic_id, status, scheduled_at DESC);

-- Appointment by patient (patient detail view)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_patient
  ON appointments(patient_id, scheduled_at DESC);

-- Call history ordered by date (dashboard, analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_calls_clinic_created
  ON ai_calls(clinic_id, created_at DESC);

-- Active calls per patient (dedup check in outbound/recall)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_calls_patient_active
  ON ai_calls(patient_id, status)
  WHERE status IN ('queued', 'calling', 'ringing', 'answered', 'in-progress');

-- Recall candidates by clinic
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recall_candidates_clinic
  ON recall_candidates(clinic_id);

-- Revenue attribution for analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_revenue_attribution_clinic_date
  ON revenue_attribution(clinic_id, created_at DESC);
