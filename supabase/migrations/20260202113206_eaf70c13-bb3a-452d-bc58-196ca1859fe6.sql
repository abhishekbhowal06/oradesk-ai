-- Drop the restrictive INSERT policy on clinics
DROP POLICY IF EXISTS "Authenticated users can create clinics" ON public.clinics;

-- Create a PERMISSIVE INSERT policy that allows any authenticated user to create a clinic
CREATE POLICY "Authenticated users can create clinics" 
ON public.clinics 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Also need to fix staff_memberships - users should be able to add themselves to a clinic they just created
-- The problem is is_clinic_admin checks if user is already admin, but they can't be admin until they're added

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Admins can manage memberships" ON public.staff_memberships;

-- Create a new policy that allows users to add themselves as first admin of a new clinic
-- OR allows existing admins to add others
CREATE POLICY "Users can add themselves or admins can add others" 
ON public.staff_memberships 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- User can add themselves
  (user_id = auth.uid())
  OR 
  -- Or existing admins can add others
  is_clinic_admin(clinic_id)
);