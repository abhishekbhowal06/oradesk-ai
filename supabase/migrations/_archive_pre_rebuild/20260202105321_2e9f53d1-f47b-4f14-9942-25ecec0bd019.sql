-- Fix security warnings: overly permissive RLS policies

-- Drop the overly permissive ai_calls policy
DROP POLICY IF EXISTS "System can manage ai calls" ON public.ai_calls;

-- Create proper policies for ai_calls
CREATE POLICY "Members can create ai calls" ON public.ai_calls 
  FOR INSERT WITH CHECK (public.is_clinic_member(clinic_id));
CREATE POLICY "Admins can update ai calls" ON public.ai_calls 
  FOR UPDATE USING (public.is_clinic_admin(clinic_id));
CREATE POLICY "Admins can delete ai calls" ON public.ai_calls 
  FOR DELETE USING (public.is_clinic_admin(clinic_id));

-- Drop the overly permissive analytics insert policy
DROP POLICY IF EXISTS "System can insert analytics" ON public.analytics_events;

-- Create proper policy for analytics insert
CREATE POLICY "Members can insert analytics" ON public.analytics_events 
  FOR INSERT WITH CHECK (clinic_id IS NULL OR public.is_clinic_member(clinic_id));

-- Fix function search paths by recreating functions with explicit search_path
CREATE OR REPLACE FUNCTION public.log_appointment_status_change()
RETURNS TRIGGER AS $$
DECLARE
  evt_type public.event_type;
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

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

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