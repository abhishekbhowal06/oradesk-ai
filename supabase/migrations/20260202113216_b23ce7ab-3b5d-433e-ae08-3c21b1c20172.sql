-- Update the clinics INSERT policy to check that user is authenticated (not just true)
DROP POLICY IF EXISTS "Authenticated users can create clinics" ON public.clinics;

CREATE POLICY "Authenticated users can create clinics" 
ON public.clinics 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);