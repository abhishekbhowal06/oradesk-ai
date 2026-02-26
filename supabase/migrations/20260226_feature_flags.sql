-- =====================================================
-- MULTI-TENANT FEATURE FLAGS
-- =====================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT false,
    clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- A flag is either global (null clinic_id) or clinic-specific
    UNIQUE(flag_key, clinic_id)
);

-- 2. Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Clinics can see their own flags or global flags
CREATE POLICY "Clinics can view their own feature flags"
    ON public.feature_flags
    FOR SELECT
    USING (
        clinic_id IS NULL OR is_clinic_member(clinic_id)
    );

-- Only service_role can manage flags
-- (Managed via admin panel or migrations)

-- 4. Initial Global Flags
INSERT INTO public.feature_flags (flag_key, is_enabled, description)
VALUES 
    ('v2_analytics', true, 'Enable enhanced enterprise analytics dashboard'),
    ('custom_ai_voices', false, 'Allow clinics to use specialized ElevenLabs voices'),
    ('multi_region_failover', true, 'Toggle global traffic steering capability')
ON CONFLICT (flag_key, clinic_id) DO NOTHING;
