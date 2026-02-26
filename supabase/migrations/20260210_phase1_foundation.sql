-- ============================================================================
-- DENTACORE OS - PHASE 1: FOUNDATION DATA LAYER
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recall_priority') THEN
        CREATE TYPE public.recall_priority AS ENUM ('low', 'medium', 'high', 'critical');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'campaign_status') THEN
        CREATE TYPE public.campaign_status AS ENUM ('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
        CREATE TYPE public.job_status AS ENUM ('pending', 'scheduled', 'in_progress', 'completed', 'failed', 'exhausted', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
        CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'booked', 'nurture', 'dismissed', 'dead');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attribution_source') THEN
        CREATE TYPE public.attribution_source AS ENUM ('ai_outreach', 'staff_direct', 'patient_portal', 'marketing');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attribution_status') THEN
        CREATE TYPE public.attribution_status AS ENUM ('pending', 'confirmed', 'completed', 'missed', 'cancelled');
    END IF;
END $$;

-- ============================================================================
-- 1. RECALL ENGINE
-- ============================================================================

-- Identified patients who need reactivation
CREATE TABLE IF NOT EXISTS public.recall_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    
    last_visit_date DATE,
    days_since_visit INTEGER GENERATED ALWAYS AS (CURRENT_DATE - last_visit_date) STORED,
    
    estimated_value DECIMAL(10,2) DEFAULT 0,
    priority_score INTEGER DEFAULT 0, -- Calculated based on value + urgency
    priority_level recall_priority DEFAULT 'low',
    
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_campaign', 'booked', 'snoozed', 'do_not_contact')),
    
    last_contact_at TIMESTAMPTZ,
    contact_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(clinic_id, patient_id) -- One candidate record per patient per clinic
);

-- ============================================================================
-- 2. CAMPAIGN ENGINE
-- ============================================================================

-- Outreach campaigns definition
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.profiles(id),
    
    name TEXT NOT NULL,
    description TEXT,
    
    status campaign_status DEFAULT 'draft',
    
    -- Configuration
    target_criteria JSONB DEFAULT '{}', -- Saved filter criteria
    outreach_channel TEXT[] DEFAULT '{voice, sms}',
    script_template_id TEXT, -- Ref to template library
    
    -- Schedule
    scheduled_start_at TIMESTAMPTZ,
    actual_start_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Constraints
    max_daily_attempts INTEGER DEFAULT 50,
    allowed_hours_start TIME DEFAULT '09:00',
    allowed_hours_end TIME DEFAULT '17:00',
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Individual execution jobs (one per patient per campaign)
CREATE TABLE IF NOT EXISTS public.outreach_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    recall_candidate_id UUID REFERENCES public.recall_candidates(id),
    
    status job_status DEFAULT 'pending',
    channel TEXT DEFAULT 'voice' CHECK (channel IN ('voice', 'sms', 'email')),
    
    scheduled_for TIMESTAMPTZ,
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    
    last_attempt_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    
    -- Outcome linking
    last_call_id UUID REFERENCES public.ai_calls(id),
    outcome_summary TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 3. LEAD HANDLING
-- ============================================================================

-- Qualified leads for staff attention
CREATE TABLE IF NOT EXISTS public.lead_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    
    source_campaign_id UUID REFERENCES public.campaigns(id),
    source_call_id UUID REFERENCES public.ai_calls(id),
    
    status lead_status DEFAULT 'new',
    priority recall_priority DEFAULT 'medium',
    
    -- Context for staff
    ai_summary TEXT,
    recommended_action TEXT,
    
    assigned_to UUID REFERENCES public.profiles(id),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    
    -- Action tracking
    actioned_at TIMESTAMPTZ,
    actioned_by UUID REFERENCES public.profiles(id),
    outcome_notes TEXT,
    resulting_appointment_id UUID REFERENCES public.appointments(id)
);

-- ============================================================================
-- 4. REVENUE ATTRIBUTION
-- ============================================================================

-- Tracking value from outreach to realized revenue
CREATE TABLE IF NOT EXISTS public.revenue_attribution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    
    appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id),
    
    -- Source Chain
    source_type attribution_source DEFAULT 'ai_outreach',
    campaign_id UUID REFERENCES public.campaigns(id),
    lead_id UUID REFERENCES public.lead_queue(id),
    recall_candidate_id UUID REFERENCES public.recall_candidates(id),
    
    -- Value Tracking
    status attribution_status DEFAULT 'pending',
    estimated_value DECIMAL(10,2),
    actual_value DECIMAL(10,2), -- Populated after appointment completion
    
    confirmed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 5. PMS SYNC
-- ============================================================================

-- State tracking for PMS integration bridge
CREATE TABLE IF NOT EXISTS public.pms_sync_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    
    pms_software TEXT NOT NULL, -- e.g., 'OpenDental', 'Dentrix'
    connection_type TEXT DEFAULT 'local_agent', -- 'local_agent', 'api', 'manual'
    
    last_sync_at TIMESTAMPTZ,
    sync_status TEXT DEFAULT 'ok', -- 'ok', 'error', 'disconnected'
    
    -- Record Counts
    patients_synced INTEGER DEFAULT 0,
    appointments_synced INTEGER DEFAULT 0,
    
    last_error TEXT,
    version TEXT, -- Agent version
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(clinic_id)
);

-- ============================================================================
-- INDEXES & CONSTRAINTS
-- ============================================================================

-- Recall Candidates
CREATE INDEX IF NOT EXISTS idx_recall_clinic_status ON public.recall_candidates(clinic_id, status);
CREATE INDEX IF NOT EXISTS idx_recall_priority ON public.recall_candidates(priority_score DESC);

-- Outreach Jobs
CREATE INDEX IF NOT EXISTS idx_jobs_processing ON public.outreach_jobs(status, scheduled_for) WHERE status IN ('pending', 'scheduled');
CREATE INDEX IF NOT EXISTS idx_jobs_campaign ON public.outreach_jobs(campaign_id);

-- Lead Queue
CREATE INDEX IF NOT EXISTS idx_leads_active ON public.lead_queue(clinic_id, status) WHERE status IN ('new', 'contacted');
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON public.lead_queue(assigned_to);

-- Attribution
CREATE INDEX IF NOT EXISTS idx_attribution_campaign ON public.revenue_attribution(campaign_id);
CREATE INDEX IF NOT EXISTS idx_attribution_created ON public.revenue_attribution(created_at);

-- ============================================================================
-- RLS POLICIES (Clinic Isolation)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.recall_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_attribution ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pms_sync_state ENABLE ROW LEVEL SECURITY;

-- Helper function reuse (assuming public.is_clinic_member exists from prev migrations)

-- Recall Candidates
DROP POLICY IF EXISTS "Members view recall candidates" ON public.recall_candidates;
CREATE POLICY "Members view recall candidates" ON public.recall_candidates FOR SELECT USING (public.is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "System manages recall candidates" ON public.recall_candidates;
CREATE POLICY "System manages recall candidates" ON public.recall_candidates FOR ALL USING (true); -- Workers/System

-- Campaigns
DROP POLICY IF EXISTS "Members view campaigns" ON public.campaigns;
CREATE POLICY "Members view campaigns" ON public.campaigns FOR SELECT USING (public.is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "Admins manage campaigns" ON public.campaigns;
CREATE POLICY "Admins manage campaigns" ON public.campaigns FOR ALL USING (public.is_clinic_admin(clinic_id)); -- Only admins execute

-- Outreach Jobs
DROP POLICY IF EXISTS "Members view jobs" ON public.outreach_jobs;
CREATE POLICY "Members view jobs" ON public.outreach_jobs FOR SELECT USING (public.is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "System manages jobs" ON public.outreach_jobs;
CREATE POLICY "System manages jobs" ON public.outreach_jobs FOR ALL USING (true);

-- Lead Queue
DROP POLICY IF EXISTS "Members view leads" ON public.lead_queue;
CREATE POLICY "Members view leads" ON public.lead_queue FOR SELECT USING (public.is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "Members update leads" ON public.lead_queue;
CREATE POLICY "Members update leads" ON public.lead_queue FOR UPDATE USING (public.is_clinic_member(clinic_id));

-- Revenue Attribution
DROP POLICY IF EXISTS "Members view attribution" ON public.revenue_attribution;
CREATE POLICY "Members view attribution" ON public.revenue_attribution FOR SELECT USING (public.is_clinic_member(clinic_id));

-- PMS Sync State
DROP POLICY IF EXISTS "Members view sync state" ON public.pms_sync_state;
CREATE POLICY "Members view sync state" ON public.pms_sync_state FOR SELECT USING (public.is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "System updates sync state" ON public.pms_sync_state;
CREATE POLICY "System updates sync state" ON public.pms_sync_state FOR ALL USING (true); -- Bridge agent updates this

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Standard updated_at triggers
DROP TRIGGER IF EXISTS update_recall_updated_at ON public.recall_candidates;
CREATE TRIGGER update_recall_updated_at BEFORE UPDATE ON public.recall_candidates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_jobs_updated_at ON public.outreach_jobs;
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.outreach_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_attribution_updated_at ON public.revenue_attribution;
CREATE TRIGGER update_attribution_updated_at BEFORE UPDATE ON public.revenue_attribution FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_sync_updated_at ON public.pms_sync_state;
CREATE TRIGGER update_sync_updated_at BEFORE UPDATE ON public.pms_sync_state FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
