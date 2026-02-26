-- =================================================================================
-- PHASE 2: SUPABASE SCHEMA (CLINICAL AI CONTROL CENTER)
-- =================================================================================

-- 1. Disable full table-scan access (Zero Trust)
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- 2. Create Core Tables
CREATE TABLE public.clinics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    country_code VARCHAR(2) NOT NULL DEFAULT 'US',
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
    rules_jsonb JSONB NOT NULL DEFAULT '{
        "safety": {
            "no_medical_diagnosis": true,
            "mandatory_compliance_greeting": true
        },
        "escalation": {
            "confidence_threshold": 85,
            "emergency_keywords": ["pain", "bleeding", "swelling", "emergency"]
        },
        "routing": {
            "voice_fallback_sms": true,
            "primary_channel": "Voice"
        }
    }'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ai_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_tag VARCHAR(20) NOT NULL UNIQUE,
    release_notes TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Note: ai_sessions and ai_transcripts support Realtime subscriptions
CREATE TABLE public.ai_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_phone VARCHAR(20),
    ai_version_id UUID REFERENCES public.ai_versions(id),
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
    amplitude NUMERIC(5,2) DEFAULT 0.00, -- Used for driving the Frontend Hologram Realtime Waveform
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.ai_metrics_daily (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    calls_handled INT DEFAULT 0,
    bookings_made INT DEFAULT 0,
    escalations INT DEFAULT 0,
    llm_tokens_used BIGINT DEFAULT 0,
    estimated_cost NUMERIC(10,4) DEFAULT 0.0000,
    UNIQUE(clinic_id, date)
);

-- =================================================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- =================================================================================

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinic_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_metrics_daily ENABLE ROW LEVEL SECURITY;

-- Dynamic RLS Policies based on User Roles mapping
CREATE POLICY "Users can view their own clinic data"
    ON public.clinics FOR SELECT
    USING (id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their clinic settings"
    ON public.clinic_settings FOR SELECT
    USING (clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can update clinic settings"
    ON public.clinic_settings FOR UPDATE
    USING (clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'dentist')));

CREATE POLICY "Clinic staff can view sessions"
    ON public.ai_sessions FOR SELECT
    USING (clinic_id IN (SELECT clinic_id FROM public.user_roles WHERE user_id = auth.uid()));

-- Enable Realtime Broadcast for Transcripts (for Hologram UI syncing)
alter publication supabase_realtime add table public.ai_transcripts;
alter publication supabase_realtime add table public.ai_sessions;
