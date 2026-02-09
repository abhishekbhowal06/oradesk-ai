-- =====================================================
-- DENTACOR PRODUCTION DATABASE SCHEMA
-- Enterprise-Grade Dental AI SaaS
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- ENUMS
-- =====================================================

-- Staff roles for RBAC
CREATE TYPE public.staff_role AS ENUM ('admin', 'receptionist');

-- Appointment lifecycle states
CREATE TYPE public.appointment_status AS ENUM (
  'scheduled', 
  'confirmed', 
  'rescheduled', 
  'completed', 
  'missed', 
  'cancelled'
);

-- AI call lifecycle states
CREATE TYPE public.call_status AS ENUM (
  'queued', 
  'calling', 
  'answered', 
  'voicemail', 
  'no_answer', 
  'failed', 
  'completed'
);

-- Call outcome types
CREATE TYPE public.call_outcome AS ENUM (
  'confirmed', 
  'rescheduled', 
  'cancelled', 
  'action_needed', 
  'unreachable'
);

-- Follow-up status
CREATE TYPE public.followup_status AS ENUM (
  'pending', 
  'in_progress', 
  'completed', 
  'exhausted', 
  'cancelled'
);

-- Task priority levels
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Task status
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');

-- Analytics event types
CREATE TYPE public.event_type AS ENUM (
  'call_initiated',
  'call_completed',
  'appointment_confirmed',
  'appointment_rescheduled',
  'appointment_cancelled',
  'appointment_missed',
  'escalation_created',
  'task_created',
  'task_completed',
  'revenue_saved',
  'patient_created',
  'staff_action'
);

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Clinics table
CREATE TABLE public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  working_hours JSONB NOT NULL DEFAULT '{
    "monday": {"start": "08:00", "end": "17:00", "closed": false},
    "tuesday": {"start": "08:00", "end": "17:00", "closed": false},
    "wednesday": {"start": "08:00", "end": "17:00", "closed": false},
    "thursday": {"start": "08:00", "end": "17:00", "closed": false},
    "friday": {"start": "08:00", "end": "17:00", "closed": false},
    "saturday": {"start": "09:00", "end": "13:00", "closed": false},
    "sunday": {"start": "00:00", "end": "00:00", "closed": true}
  }'::jsonb,
  ai_settings JSONB NOT NULL DEFAULT '{
    "confirmation_calls_enabled": true,
    "reminder_hours_before": 24,
    "max_follow_up_attempts": 3,
    "follow_up_delay_hours": 4
  }'::jsonb,
  notification_settings JSONB NOT NULL DEFAULT '{
    "email_enabled": true,
    "sms_enabled": true,
    "action_required_timing": "immediate"
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Profiles table (links to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Staff memberships (links staff to clinics with roles)
CREATE TABLE public.staff_memberships (
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

-- Patients table
CREATE TABLE public.patients (
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

-- Appointments table
CREATE TABLE public.appointments (
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

-- AI Calls table (tracks all AI-initiated calls)
CREATE TABLE public.ai_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  call_type TEXT NOT NULL DEFAULT 'confirmation' CHECK (call_type IN ('confirmation', 'reminder', 'follow_up', 'rescheduling')),
  status call_status NOT NULL DEFAULT 'queued',
  outcome call_outcome,
  duration_seconds INTEGER,
  transcript JSONB,
  -- AI Transparency Layer
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  ai_reasoning TEXT,
  escalation_required BOOLEAN NOT NULL DEFAULT false,
  escalation_reason TEXT,
  model_version TEXT DEFAULT 'DENT-AI-v3.2.1',
  processing_time_ms INTEGER,
  -- Business impact
  revenue_impact DECIMAL(10,2),
  -- Telephony metadata (Twilio-ready)
  external_call_id TEXT,
  call_started_at TIMESTAMPTZ,
  call_ended_at TIMESTAMPTZ,
  recording_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Follow-up schedules table
CREATE TABLE public.follow_up_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  scheduled_for TIMESTAMPTZ NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  status followup_status NOT NULL DEFAULT 'pending',
  delay_hours INTEGER NOT NULL DEFAULT 4,
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  failure_reason TEXT,
  related_call_id UUID REFERENCES public.ai_calls(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Staff tasks table (for escalations and manual actions)
CREATE TABLE public.staff_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  ai_call_id UUID REFERENCES public.ai_calls(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'pending',
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Analytics events table
CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID REFERENCES public.clinics(id) ON DELETE CASCADE,
  event_type event_type NOT NULL,
  user_id UUID REFERENCES public.profiles(id),
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  ai_call_id UUID REFERENCES public.ai_calls(id) ON DELETE SET NULL,
  event_data JSONB,
  revenue_impact DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_staff_memberships_clinic ON public.staff_memberships(clinic_id);
CREATE INDEX idx_staff_memberships_user ON public.staff_memberships(user_id);
CREATE INDEX idx_patients_clinic ON public.patients(clinic_id);
CREATE INDEX idx_patients_phone ON public.patients(phone);
CREATE INDEX idx_appointments_clinic ON public.appointments(clinic_id);
CREATE INDEX idx_appointments_patient ON public.appointments(patient_id);
CREATE INDEX idx_appointments_scheduled ON public.appointments(scheduled_at);
CREATE INDEX idx_appointments_status ON public.appointments(status);
CREATE INDEX idx_ai_calls_clinic ON public.ai_calls(clinic_id);
CREATE INDEX idx_ai_calls_appointment ON public.ai_calls(appointment_id);
CREATE INDEX idx_ai_calls_status ON public.ai_calls(status);
CREATE INDEX idx_follow_ups_clinic ON public.follow_up_schedules(clinic_id);
CREATE INDEX idx_follow_ups_status ON public.follow_up_schedules(status);
CREATE INDEX idx_follow_ups_scheduled ON public.follow_up_schedules(scheduled_for);
CREATE INDEX idx_staff_tasks_clinic ON public.staff_tasks(clinic_id);
CREATE INDEX idx_staff_tasks_status ON public.staff_tasks(status);
CREATE INDEX idx_staff_tasks_assigned ON public.staff_tasks(assigned_to);
CREATE INDEX idx_analytics_clinic ON public.analytics_events(clinic_id);
CREATE INDEX idx_analytics_type ON public.analytics_events(event_type);
CREATE INDEX idx_analytics_created ON public.analytics_events(created_at);

-- =====================================================
-- SECURITY HELPER FUNCTIONS
-- =====================================================

-- Check if user is a member of a clinic
CREATE OR REPLACE FUNCTION public.is_clinic_member(clinic_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_memberships
    WHERE clinic_id = clinic_id_param
      AND user_id = auth.uid()
      AND is_active = true
  );
$$;

-- Check if user is an admin of a clinic
CREATE OR REPLACE FUNCTION public.is_clinic_admin(clinic_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_memberships
    WHERE clinic_id = clinic_id_param
      AND user_id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
$$;

-- Get user's clinic IDs
CREATE OR REPLACE FUNCTION public.get_user_clinic_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT clinic_id FROM public.staff_memberships
  WHERE user_id = auth.uid() AND is_active = true;
$$;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables
CREATE TRIGGER update_clinics_updated_at BEFORE UPDATE ON public.clinics FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_staff_memberships_updated_at BEFORE UPDATE ON public.staff_memberships FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_ai_calls_updated_at BEFORE UPDATE ON public.ai_calls FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_follow_ups_updated_at BEFORE UPDATE ON public.follow_up_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_staff_tasks_updated_at BEFORE UPDATE ON public.staff_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Log analytics event when appointment status changes
CREATE OR REPLACE FUNCTION public.log_appointment_status_change()
RETURNS TRIGGER AS $$
DECLARE
  evt_type event_type;
BEGIN
  IF NEW.status != OLD.status THEN
    CASE NEW.status
      WHEN 'confirmed' THEN evt_type := 'appointment_confirmed';
      WHEN 'rescheduled' THEN evt_type := 'appointment_rescheduled';
      WHEN 'cancelled' THEN evt_type := 'appointment_cancelled';
      WHEN 'missed' THEN evt_type := 'appointment_missed';
      ELSE evt_type := 'staff_action';
    END CASE;
    
    INSERT INTO public.analytics_events (
      clinic_id, event_type, user_id, appointment_id, patient_id, event_data
    ) VALUES (
      NEW.clinic_id,
      evt_type,
      auth.uid(),
      NEW.id,
      NEW.patient_id,
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_appointment_status_change
  AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.log_appointment_status_change();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (id = auth.uid());

-- Clinics policies
CREATE POLICY "Members can view their clinics" ON public.clinics FOR SELECT USING (public.is_clinic_member(id));
CREATE POLICY "Admins can update their clinics" ON public.clinics FOR UPDATE USING (public.is_clinic_admin(id));
CREATE POLICY "Admins can delete their clinics" ON public.clinics FOR DELETE USING (public.is_clinic_admin(id));
CREATE POLICY "Authenticated users can create clinics" ON public.clinics FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Staff memberships policies
CREATE POLICY "Members can view clinic memberships" ON public.staff_memberships FOR SELECT USING (public.is_clinic_member(clinic_id));
CREATE POLICY "Admins can manage memberships" ON public.staff_memberships FOR INSERT WITH CHECK (public.is_clinic_admin(clinic_id));
CREATE POLICY "Admins can update memberships" ON public.staff_memberships FOR UPDATE USING (public.is_clinic_admin(clinic_id));
CREATE POLICY "Admins can delete memberships" ON public.staff_memberships FOR DELETE USING (public.is_clinic_admin(clinic_id));

-- Patients policies
CREATE POLICY "Members can view clinic patients" ON public.patients FOR SELECT USING (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can create patients" ON public.patients FOR INSERT WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can update patients" ON public.patients FOR UPDATE USING (public.is_clinic_member(clinic_id));
CREATE POLICY "Admins can delete patients" ON public.patients FOR DELETE USING (public.is_clinic_admin(clinic_id));

-- Appointments policies
CREATE POLICY "Members can view clinic appointments" ON public.appointments FOR SELECT USING (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can create appointments" ON public.appointments FOR INSERT WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can update appointments" ON public.appointments FOR UPDATE USING (public.is_clinic_member(clinic_id));
CREATE POLICY "Admins can delete appointments" ON public.appointments FOR DELETE USING (public.is_clinic_admin(clinic_id));

-- AI calls policies
CREATE POLICY "Members can view ai calls" ON public.ai_calls FOR SELECT USING (public.is_clinic_member(clinic_id));
CREATE POLICY "System can manage ai calls" ON public.ai_calls FOR ALL USING (true);

-- Follow-up schedules policies
CREATE POLICY "Members can view follow-ups" ON public.follow_up_schedules FOR SELECT USING (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can manage follow-ups" ON public.follow_up_schedules FOR ALL USING (public.is_clinic_member(clinic_id));

-- Staff tasks policies
CREATE POLICY "Members can view clinic tasks" ON public.staff_tasks FOR SELECT USING (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can create tasks" ON public.staff_tasks FOR INSERT WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Members can update tasks" ON public.staff_tasks FOR UPDATE USING (public.is_clinic_member(clinic_id));
CREATE POLICY "Admins can delete tasks" ON public.staff_tasks FOR DELETE USING (public.is_clinic_admin(clinic_id));

-- Analytics policies
CREATE POLICY "Members can view clinic analytics" ON public.analytics_events FOR SELECT USING (clinic_id IS NULL OR public.is_clinic_member(clinic_id));
CREATE POLICY "System can insert analytics" ON public.analytics_events FOR INSERT WITH CHECK (true);