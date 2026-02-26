-- Fix: drop and recreate INSERT policy to allow public role (JWT WITH CHECK handles auth)
DROP POLICY IF EXISTS "Authenticated users can create clinics" ON public.clinics;

CREATE POLICY "Authenticated users can create clinics"
  ON public.clinics
  FOR INSERT
  TO public
  WITH CHECK (auth.uid() IS NOT NULL);