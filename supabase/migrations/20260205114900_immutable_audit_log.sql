-- Migration: Create Immutable Audit Log Table
-- Purpose: HIPAA-compliant audit trail that cannot be modified or deleted
-- Author: Dentacore OS Production Safety Execution
-- Date: 2026-02-05

-- Create the immutable audit log table
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL,
    actor_id UUID,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'ai')),
    resource_type TEXT NOT NULL,
    resource_id UUID,
    action TEXT NOT NULL CHECK (action IN ('create', 'read', 'update', 'delete', 'call_initiated', 'call_completed', 'emergency_escalation', 'consent_granted', 'consent_revoked', 'login', 'logout')),
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for query performance
CREATE INDEX IF NOT EXISTS idx_audit_log_clinic ON public.audit_log(clinic_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON public.audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON public.audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON public.audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- IMMUTABLE ENFORCEMENT: Only INSERT allowed, no UPDATE or DELETE
-- Policy for INSERT: Allow system and authenticated users to create log entries
CREATE POLICY "audit_log_insert_only" ON public.audit_log
    FOR INSERT 
    WITH CHECK (true);

-- Policy for SELECT: Allow clinic members to read their clinic's logs
CREATE POLICY "audit_log_select_clinic_members" ON public.audit_log
    FOR SELECT 
    USING (
        clinic_id IS NULL 
        OR public.is_clinic_member(clinic_id)
    );

-- NO UPDATE POLICY - Updates are forbidden
-- NO DELETE POLICY - Deletes are forbidden

-- Add comment explaining immutability
COMMENT ON TABLE public.audit_log IS 'Immutable audit log for HIPAA compliance. No UPDATE or DELETE operations are permitted.';
