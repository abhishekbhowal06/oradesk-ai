-- ============================================================================
-- ORADESK AI — PATIENT INTELLIGENCE & FOLLOW-UP ENGINE
-- Migration: Follow-Up as First-Class Entity
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'follow_up_type') THEN
        CREATE TYPE public.follow_up_type AS ENUM (
            'post_treatment',
            'treatment_plan_review',
            'recall_reactivation',
            'payment_follow_up',
            'lab_results',
            'custom'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'follow_up_execution_mode') THEN
        CREATE TYPE public.follow_up_execution_mode AS ENUM ('ai_automated', 'staff_manual');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'follow_up_priority') THEN
        CREATE TYPE public.follow_up_priority AS ENUM ('normal', 'high', 'urgent');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'follow_up_task_status') THEN
        CREATE TYPE public.follow_up_task_status AS ENUM (
            'scheduled',
            'queued',
            'in_progress',
            'awaiting_approval',
            'approved',
            'completed',
            'failed',
            'cancelled'
        );
    END IF;
END $$;

-- ============================================================================
-- FOLLOW-UP TASKS TABLE (First-Class Entity)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.follow_up_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    
    -- Who created it
    created_by UUID REFERENCES public.profiles(id),
    
    -- Follow-up definition
    follow_up_type follow_up_type NOT NULL DEFAULT 'custom',
    execution_mode follow_up_execution_mode NOT NULL DEFAULT 'ai_automated',
    priority follow_up_priority NOT NULL DEFAULT 'normal',
    
    -- Scheduling
    due_date DATE NOT NULL,
    due_time TIME,
    
    -- Instructions
    doctor_instructions TEXT,
    
    -- Status tracking
    status follow_up_task_status NOT NULL DEFAULT 'scheduled',
    
    -- AI execution tracking
    ai_call_id UUID REFERENCES public.ai_calls(id),
    ai_result_summary TEXT,
    ai_executed_at TIMESTAMPTZ,
    
    -- Approval workflow
    approved_by UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMPTZ,
    approval_notes TEXT,
    
    -- Completion
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES public.profiles(id),
    outcome_notes TEXT,
    
    -- Campaign linkage
    campaign_id UUID REFERENCES public.campaigns(id),
    outreach_job_id UUID REFERENCES public.outreach_jobs(id),
    
    -- Related appointment
    related_appointment_id UUID REFERENCES public.appointments(id),
    resulting_appointment_id UUID REFERENCES public.appointments(id),
    
    -- Retry tracking
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_attempt_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    failure_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_followup_tasks_clinic ON public.follow_up_tasks(clinic_id);
CREATE INDEX IF NOT EXISTS idx_followup_tasks_patient ON public.follow_up_tasks(patient_id);
CREATE INDEX IF NOT EXISTS idx_followup_tasks_status ON public.follow_up_tasks(status, due_date);
CREATE INDEX IF NOT EXISTS idx_followup_tasks_due ON public.follow_up_tasks(due_date) WHERE status IN ('scheduled', 'queued');
CREATE INDEX IF NOT EXISTS idx_followup_tasks_overdue ON public.follow_up_tasks(due_date, status)
    WHERE status IN ('scheduled', 'queued') AND due_date < CURRENT_DATE;
CREATE INDEX IF NOT EXISTS idx_followup_tasks_approval ON public.follow_up_tasks(status)
    WHERE status = 'awaiting_approval';

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE public.follow_up_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members view follow-ups" ON public.follow_up_tasks;
CREATE POLICY "Members view follow-ups" ON public.follow_up_tasks
    FOR SELECT USING (public.is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "Members manage follow-ups" ON public.follow_up_tasks;
CREATE POLICY "Members manage follow-ups" ON public.follow_up_tasks
    FOR ALL USING (public.is_clinic_member(clinic_id));

-- ============================================================================
-- TRIGGERS
-- ============================================================================
DROP TRIGGER IF EXISTS update_followup_tasks_updated_at ON public.follow_up_tasks;
CREATE TRIGGER update_followup_tasks_updated_at
    BEFORE UPDATE ON public.follow_up_tasks
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- VIEWS: Patient Intelligence Aggregates
-- ============================================================================
CREATE OR REPLACE VIEW public.patient_intelligence AS
SELECT
    p.id AS patient_id,
    p.clinic_id,
    p.first_name,
    p.last_name,
    p.phone,
    p.email,
    p.status AS patient_status,
    p.last_visit,
    p.created_at,
    
    -- Follow-up counts
    COALESCE(fu.pending_followups, 0) AS pending_followups,
    COALESCE(fu.overdue_followups, 0) AS overdue_followups,
    fu.next_followup_date,
    
    -- Appointment data
    a.next_appointment_date,
    a.next_appointment_type,
    COALESCE(a.total_appointments, 0) AS total_appointments,
    COALESCE(a.completed_appointments, 0) AS completed_appointments,
    COALESCE(a.missed_appointments, 0) AS missed_appointments,
    
    -- Revenue Intelligence
    COALESCE(ra.lifetime_value, 0) AS lifetime_value,
    COALESCE(ra.outstanding_balance, 0) AS outstanding_balance,
    
    -- AI Engagement
    COALESCE(ai.total_ai_calls, 0) AS total_ai_calls,
    COALESCE(ai.successful_ai_calls, 0) AS successful_ai_calls,
    CASE
        WHEN COALESCE(ai.total_ai_calls, 0) = 0 THEN 0
        ELSE ROUND((COALESCE(ai.successful_ai_calls, 0)::DECIMAL / ai.total_ai_calls) * 100)
    END AS ai_engagement_score,
    
    -- Risk Score
    CASE
        WHEN p.status = 'unreachable' THEN 'high'
        WHEN COALESCE(a.missed_appointments, 0) >= 2 THEN 'high'
        WHEN p.last_visit IS NULL OR p.last_visit < CURRENT_DATE - INTERVAL '180 days' THEN 'high'
        WHEN COALESCE(a.missed_appointments, 0) >= 1 THEN 'medium'
        WHEN p.last_visit < CURRENT_DATE - INTERVAL '90 days' THEN 'medium'
        ELSE 'low'
    END AS risk_level
    
FROM public.patients p

LEFT JOIN LATERAL (
    SELECT
        COUNT(*) FILTER (WHERE ft.status IN ('scheduled', 'queued')) AS pending_followups,
        COUNT(*) FILTER (WHERE ft.status IN ('scheduled', 'queued') AND ft.due_date < CURRENT_DATE) AS overdue_followups,
        MIN(ft.due_date) FILTER (WHERE ft.status IN ('scheduled', 'queued')) AS next_followup_date
    FROM public.follow_up_tasks ft
    WHERE ft.patient_id = p.id AND ft.clinic_id = p.clinic_id
) fu ON TRUE

LEFT JOIN LATERAL (
    SELECT
        MIN(apt.scheduled_at) FILTER (WHERE apt.status IN ('scheduled', 'confirmed') AND apt.scheduled_at > now()) AS next_appointment_date,
        (SELECT apt2.procedure_name FROM public.appointments apt2
         WHERE apt2.patient_id = p.id AND apt2.status IN ('scheduled', 'confirmed') AND apt2.scheduled_at > now()
         ORDER BY apt2.scheduled_at LIMIT 1) AS next_appointment_type,
        COUNT(*) AS total_appointments,
        COUNT(*) FILTER (WHERE apt.status = 'completed') AS completed_appointments,
        COUNT(*) FILTER (WHERE apt.status = 'missed') AS missed_appointments
    FROM public.appointments apt
    WHERE apt.patient_id = p.id AND apt.clinic_id = p.clinic_id
) a ON TRUE

LEFT JOIN LATERAL (
    SELECT
        COALESCE(SUM(rev.actual_value), SUM(rev.estimated_value), 0) AS lifetime_value,
        0 AS outstanding_balance -- Placeholder: integrate with billing
    FROM public.revenue_attribution rev
    WHERE rev.patient_id = p.id AND rev.clinic_id = p.clinic_id
) ra ON TRUE

LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS total_ai_calls,
        COUNT(*) FILTER (WHERE ac.status = 'completed') AS successful_ai_calls
    FROM public.ai_calls ac
    WHERE ac.patient_id = p.id AND ac.clinic_id = p.clinic_id
) ai ON TRUE;
