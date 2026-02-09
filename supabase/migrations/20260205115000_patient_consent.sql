-- Migration: Create Patient Consent Table
-- Purpose: Track patient consent for automated contact (TCPA/HIPAA compliance)
-- Author: Dentacore OS Production Safety Execution
-- Date: 2026-02-05

-- Create the patient consents table
CREATE TABLE IF NOT EXISTS public.patient_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL CHECK (consent_type IN ('automated_contact', 'sms', 'email', 'voice_recording', 'data_processing')),
    granted BOOLEAN NOT NULL DEFAULT false,
    granted_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    source TEXT NOT NULL CHECK (source IN ('web_form', 'verbal', 'signed_form', 'implied', 'intake_form')),
    recorded_by UUID REFERENCES public.profiles(id),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Ensure unique consent type per patient
    CONSTRAINT unique_patient_consent_type UNIQUE (patient_id, consent_type)
);

-- Create indexes for query performance
CREATE INDEX IF NOT EXISTS idx_consent_patient ON public.patient_consents(patient_id);
CREATE INDEX IF NOT EXISTS idx_consent_type_granted ON public.patient_consents(consent_type, granted) WHERE granted = true;
CREATE INDEX IF NOT EXISTS idx_consent_active ON public.patient_consents(patient_id, consent_type) WHERE granted = true AND revoked_at IS NULL;

-- Enable Row Level Security
ALTER TABLE public.patient_consents ENABLE ROW LEVEL SECURITY;

-- Policy: Allow clinic members to manage consents for their patients
CREATE POLICY "consent_clinic_member_access" ON public.patient_consents
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.patients p
            WHERE p.id = patient_consents.patient_id
            AND public.is_clinic_member(p.clinic_id)
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.patients p
            WHERE p.id = patient_consents.patient_id
            AND public.is_clinic_member(p.clinic_id)
        )
    );

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_patient_consents_updated_at
    BEFORE UPDATE ON public.patient_consents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment explaining purpose
COMMENT ON TABLE public.patient_consents IS 'Tracks patient consent for various contact methods. Required for TCPA and HIPAA compliance before automated calling.';

-- Add helpful function to check consent
CREATE OR REPLACE FUNCTION public.has_consent(
    p_patient_id UUID,
    p_consent_type TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.patient_consents
        WHERE patient_id = p_patient_id
        AND consent_type = p_consent_type
        AND granted = true
        AND revoked_at IS NULL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
