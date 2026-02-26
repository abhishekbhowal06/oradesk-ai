-- Migration: Immutable Audit Logs
-- Purpose: Support SOC2/HIPAA compliance by tracking all administrative actions

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL, -- The user performing the action
    action VARCHAR(255) NOT NULL, -- e.g., 'user.invite', 'clinic.update', 'patient.delete'
    resource VARCHAR(255) NOT NULL, -- The entity being affected
    metadata JSONB DEFAULT '{}'::jsonb, -- Additional context
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_clinic_created 
ON public.audit_logs (clinic_id, created_at DESC);

-- RLS Policies
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Service Role can do everything (used by backend for inserting logs)
-- Clinics can VIEW their own logs
CREATE POLICY "tenant_isolation_select_audit_logs" 
ON public.audit_logs 
FOR SELECT 
USING (public.user_belongs_to_clinic(clinic_id));

-- NO INSERT/UPDATE/DELETE policies for authenticated users.
-- Audit logs can ONLY be written by the backend via service_role to guarantee immutability.
-- No one, not even system admins, should delete audit logs.
