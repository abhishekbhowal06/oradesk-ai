-- Grant INSERT, SELECT, UPDATE, DELETE to anon and authenticated roles on clinics
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinics TO authenticated;