-- LEADS TABLE (Feature Gap: Dubai Persona)
-- Tracks potential patients who haven't booked yet

-- 1. Create Enums
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_status') THEN
        CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'booked', 'nurture', 'dismissed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_priority') THEN
        CREATE TYPE public.lead_priority AS ENUM ('low', 'medium', 'high', 'critical');
    END IF;
END $$;

-- 2. Create Table
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE, -- Link to patient record (even if implicit)
    status lead_status NOT NULL DEFAULT 'new',
    priority lead_priority NOT NULL DEFAULT 'medium',
    source TEXT DEFAULT 'inbound_call',
    ai_summary TEXT,
    last_contacted_at TIMESTAMPTZ,
    next_followup_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. RLS Policies
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Allow clinic members to view their leads
CREATE POLICY "Clinic members can view leads" ON public.leads
    FOR SELECT
    USING (public.is_clinic_member(clinic_id));

-- Allow clinic members to insert leads
CREATE POLICY "Clinic members can insert leads" ON public.leads
    FOR INSERT
    WITH CHECK (public.is_clinic_member(clinic_id));

-- Allow clinic members to update leads
CREATE POLICY "Clinic members can update leads" ON public.leads
    FOR UPDATE
    USING (public.is_clinic_member(clinic_id));

-- 4. Triggers (Updated At)
CREATE OR REPLACE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON public.leads
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
