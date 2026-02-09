-- Add Sync Columns to Appointments and Patients
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS external_id TEXT,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS external_id TEXT,
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

-- Indicies for fast lookups during sync
CREATE INDEX IF NOT EXISTS idx_appointments_external_id ON public.appointments(clinic_id, external_id);
CREATE INDEX IF NOT EXISTS idx_patients_external_id ON public.patients(clinic_id, external_id);

-- Create a log table for the sync bridge
CREATE TABLE IF NOT EXISTS public.pms_sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    sync_status TEXT NOT NULL, -- 'success', 'failed'
    records_processed INTEGER DEFAULT 0,
    errors JSONB,
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ
);

-- RLS for sync logs
ALTER TABLE public.pms_sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view sync logs" ON public.pms_sync_logs FOR SELECT USING (public.is_clinic_admin(clinic_id));
CREATE POLICY "System can insert sync logs" ON public.pms_sync_logs FOR INSERT WITH CHECK (true);
