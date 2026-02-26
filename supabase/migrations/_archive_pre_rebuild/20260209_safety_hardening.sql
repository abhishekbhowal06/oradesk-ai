-- SAFETY HARDENING MIGRATION
-- 1. Add configuration columns to clinics table
-- 2. Implement find_consent_conflicts RPC for operations reliability

-- 1. Add configuration columns
ALTER TABLE IF EXISTS public.clinics
ADD COLUMN IF NOT EXISTS escalation_phone TEXT,
ADD COLUMN IF NOT EXISTS ai_disclosure_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

COMMENT ON COLUMN public.clinics.escalation_phone IS 'Phone number to transfer patients to during business hours/emergencies';
COMMENT ON COLUMN public.clinics.ai_disclosure_enabled IS 'Whether to play the AI disclosure message at start of calls';

-- 2. Implement find_consent_conflicts RPC
-- Returns appointments where the patient has explicitly revoked consent
CREATE OR REPLACE FUNCTION public.find_consent_conflicts()
RETURNS TABLE (
    appointment_id UUID,
    patient_id UUID,
    clinic_id UUID,
    scheduled_at TIMESTAMPTZ,
    consent_revoked_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id AS appointment_id,
        a.patient_id,
        a.clinic_id,
        a.scheduled_at,
        pc.revoked_at AS consent_revoked_at
    FROM 
        public.appointments a
    JOIN 
        public.patient_consents pc ON a.patient_id = pc.patient_id
    WHERE 
        a.status = 'scheduled'
        AND a.scheduled_at > NOW()
        AND pc.consent_type = 'automated_contact'
        AND pc.revoked_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.find_consent_conflicts IS 'Detects scheduled appointments where the patient has revoked automated contact consent';
