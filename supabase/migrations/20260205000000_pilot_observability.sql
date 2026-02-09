-- Enable tracking of AI Safety Toggles (Audit Trail)
CREATE OR REPLACE FUNCTION public.log_clinic_settings_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Track AI Global Kill Switch
  IF (OLD.ai_settings->>'confirmation_calls_enabled')::boolean != (NEW.ai_settings->>'confirmation_calls_enabled')::boolean THEN
    INSERT INTO public.analytics_events (
      clinic_id,
      event_type,
      user_id,
      event_data
    ) VALUES (
      NEW.id,
      'staff_action',
      auth.uid(), -- Will be null if system update, but usually driven by API
      jsonb_build_object(
        'action', 'toggle_ai_confirmation',
        'enabled', (NEW.ai_settings->>'confirmation_calls_enabled')::boolean,
        'previous', (OLD.ai_settings->>'confirmation_calls_enabled')::boolean,
        'timestamp', now()
      )
    );
  END IF;

  -- Track Follow-up Logic Changes
  IF (OLD.ai_settings->>'follow_up_enabled')::boolean != (NEW.ai_settings->>'follow_up_enabled')::boolean THEN
    INSERT INTO public.analytics_events (
      clinic_id,
      event_type,
      user_id,
      event_data
    ) VALUES (
      NEW.id,
      'staff_action',
      auth.uid(),
      jsonb_build_object(
        'action', 'toggle_ai_followup',
        'enabled', (NEW.ai_settings->>'follow_up_enabled')::boolean,
        'previous', (OLD.ai_settings->>'follow_up_enabled')::boolean,
        'timestamp', now()
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_clinic_settings_change ON public.clinics;
CREATE TRIGGER on_clinic_settings_change
  AFTER UPDATE ON public.clinics
  FOR EACH ROW EXECUTE FUNCTION public.log_clinic_settings_change();
