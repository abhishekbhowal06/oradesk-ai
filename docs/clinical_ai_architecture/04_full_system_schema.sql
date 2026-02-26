-- =================================================================================
-- FULL CLINICAL SYSTEM SCHEMA
-- =================================================================================

-- 1. Disable full table-scan access (Zero Trust)
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- Core Infrastructure
CREATE TABLE public.clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT,
    timezone TEXT NOT NULL DEFAULT 'America/New_York',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('dentist', 'admin', 'frontdesk')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, clinic_id)
);

CREATE TABLE public.clinic_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    safety_jsonb JSONB NOT NULL DEFAULT '{
        "no_diagnosis": true,
        "consent_greeting": true,
        "escalation_threshold": 85,
        "emergency_keywords": ["pain", "bleeding", "swollen", "broken"]
    }'::jsonb,
    deployment_jsonb JSONB NOT NULL DEFAULT '{
        "primary_voice": "+15550192834",
        "whatsapp_enabled": false,
        "widget_theme": "#0d5e5e"
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Doctor & Services (Clinic Configuration)
CREATE TABLE public.doctors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    specialty TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 30,
    price NUMERIC(10,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    is_closed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Knowledge & Training Center
CREATE TABLE public.knowledge_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('url', 'file', 'manual')),
    name TEXT NOT NULL,
    url TEXT,
    last_synced_at TIMESTAMPTZ,
    status VARCHAR(50) DEFAULT 'unprocessed',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedded_vector TEXT, -- Reserved for pgvector implementation 
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- AI Intelligence & Transcripts
CREATE TABLE public.ai_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_identifier TEXT,
    status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'completed', 'escalated', 'failed')),
    escalation_reason TEXT,
    intent_confidence NUMERIC(5,2),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE public.ai_transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.ai_sessions(id) ON DELETE CASCADE,
    speaker VARCHAR(20) NOT NULL CHECK (speaker IN ('ai', 'patient', 'system')),
    content TEXT NOT NULL,
    sequence INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Analytics & Tracking
CREATE TABLE public.ai_metrics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    calls_handled INT DEFAULT 0,
    booking_conversions INT DEFAULT 0,
    escalation_rate NUMERIC(5,2) DEFAULT 0.00,
    revenue_assisted NUMERIC(10,2) DEFAULT 0.00,
    llm_tokens_used BIGINT DEFAULT 0,
    estimated_cost NUMERIC(10,4) DEFAULT 0.0000,
    UNIQUE(clinic_id, date)
);

CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS Enables
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_metrics_daily ENABLE ROW LEVEL SECURITY;

-- PostgREST Data Access Policies mapping 
CREATE POLICY "Users can view their own clinic data"
    ON public.clinics FOR SELECT
    USING (id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their clinic settings"
    ON public.clinic_settings FOR SELECT
    USING (clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can update clinic settings"
    ON public.clinic_settings FOR UPDATE
    USING (clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'dentist')));

-- Expose Transcripts and Sessions to Realtime
alter publication supabase_realtime add table public.ai_transcripts;
alter publication supabase_realtime add table public.ai_sessions;
