-- Add onboarding_completed column to clinics table
ALTER TABLE public.clinics 
ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;