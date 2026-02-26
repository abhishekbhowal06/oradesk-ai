-- =====================================================
-- RESTORE CORE SCHEMA (Fixes Missing Tables)
-- Based on: 20260202105302_9090a281-9c7a-4949-b513-9c69d3bb851a.sql
-- =====================================================

-- 1. ENUMS (Safe Creation)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'staff_role') THEN
        CREATE TYPE public.staff_role AS ENUM ('admin', 'receptionist');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status') THEN
        CREATE TYPE public.appointment_status AS ENUM ('scheduled', 'confirmed', 'rescheduled', 'completed', 'missed', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_status') THEN
        CREATE TYPE public.call_status AS ENUM ('queued', 'calling', 'answered', 'voicemail', 'no_answer', 'failed', 'completed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'call_outcome') THEN
        CREATE TYPE public.call_outcome AS ENUM ('confirmed', 'rescheduled', 'cancelled', 'action_needed', 'unreachable');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'followup_status') THEN
        CREATE TYPE public.followup_status AS ENUM ('pending', 'in_progress', 'completed', 'exhausted', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
        CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_type') THEN
        CREATE TYPE public.event_type AS ENUM ('call_initiated', 'call_completed', 'appointment_confirmed', 'appointment_rescheduled', 'appointment_cancelled', 'appointment_missed', 'escalation_created', 'task_created', 'task_completed', 'revenue_saved', 'patient_created', 'staff_action');
    END IF;
END $$;

-- 2. TABLES
CREATE TABLE IF NOT EXISTS public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  working_hours JSONB NOT NULL DEFAULT '{"monday": {"start": "08:00", "end": "17:00", "closed": false}, "tuesday": {"start": "08:00", "end": "17:00", "closed": false}, "wednesday": {"start": "08:00", "end": "17:00", "closed": false}, "thursday": {"start": "08:00", "end": "17:00", "closed": false}, "friday": {"start": "08:00", "end": "17:00", "closed": false}, "saturday": {"start": "09:00", "end": "13:00", "closed": false}, "sunday": {"start": "00:00", "end": "00:00", "closed": true}}'::jsonb,
  ai_settings JSONB NOT NULL DEFAULT '{"confirmation_calls_enabled": true, "reminder_hours_before": 24, "max_follow_up_attempts": 3, "follow_up_delay_hours": 4}'::jsonb,
  notification_settings JSONB NOT NULL DEFAULT '{"email_enabled": true, "sms_enabled": true, "action_required_timing": "immediate"}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles matches auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role staff_role NOT NULL DEFAULT 'receptionist',
  invited_by UUID REFERENCES public.profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(clinic_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  date_of_birth DATE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'unreachable')),
  last_visit DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  procedure_name TEXT NOT NULL,
  status appointment_status NOT NULL DEFAULT 'scheduled',
  ai_managed BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  conflict_warning TEXT,
  confirmed_at TIMESTAMPTZ,
  rescheduled_from TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  updated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. RLS POLICIES (Simplified for Recovery)
ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper function for RLS
CREATE OR REPLACE FUNCTION public.is_clinic_member(clinic_id_param UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_memberships
    WHERE clinic_id = clinic_id_param
      AND user_id = auth.uid()
      AND is_active = true
  );
$$;

-- Authenticated users can create clinics
DO $$ BEGIN
    DROP POLICY IF EXISTS "Authenticated users can create clinics" ON public.clinics;
    CREATE POLICY "Authenticated users can create clinics" ON public.clinics FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Service Role Bypass (Implicit)
