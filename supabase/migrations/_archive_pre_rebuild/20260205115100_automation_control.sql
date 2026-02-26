-- Migration: Add Automation Control Columns to Clinics
-- Purpose: Allow staff to pause/resume all automation for a clinic
-- Author: Dentacore OS Production Safety Execution
-- Date: 2026-02-05

-- Add automation control columns
ALTER TABLE public.clinics
    ADD COLUMN IF NOT EXISTS automation_paused BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS automation_paused_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS automation_paused_by UUID REFERENCES public.profiles(id);

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_clinics_automation_paused 
    ON public.clinics(automation_paused) 
    WHERE automation_paused = true;

-- Add comment explaining purpose
COMMENT ON COLUMN public.clinics.automation_paused IS 'When true, all automated calls are blocked for this clinic';
COMMENT ON COLUMN public.clinics.automation_paused_at IS 'Timestamp when automation was paused';
COMMENT ON COLUMN public.clinics.automation_paused_by IS 'User who paused automation';
