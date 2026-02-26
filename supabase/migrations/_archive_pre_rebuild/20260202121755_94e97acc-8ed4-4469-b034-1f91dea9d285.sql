-- Create RPC function to create a clinic and add creator as admin atomically
CREATE OR REPLACE FUNCTION public.create_clinic_with_admin(clinic_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_clinic_id uuid;
BEGIN
  -- Create the clinic
  INSERT INTO public.clinics (name)
  VALUES (clinic_name)
  RETURNING id INTO new_clinic_id;

  -- Add the caller as admin
  INSERT INTO public.staff_memberships (clinic_id, user_id, role)
  VALUES (new_clinic_id, auth.uid(), 'admin');

  RETURN new_clinic_id;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.create_clinic_with_admin(text) TO authenticated;