-- Fix RLS policies for profiles and patients tables to deny anonymous access
-- This addresses the PUBLIC_USER_DATA and EXPOSED_SENSITIVE_DATA findings

-- Drop existing overly permissive policies on profiles if any
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;

-- Update the profiles SELECT policy to explicitly require authentication
-- The existing policy "Users can view own profile" already restricts to auth.uid() = id
-- But we need to ensure there's no fallback for unauthenticated users

-- Create a policy that explicitly denies anonymous access by requiring auth.uid() IS NOT NULL
-- This is already handled by the existing policy (id = auth.uid()), but let's be explicit

-- For patients table, ensure there's no public access
-- The existing policies use is_clinic_member() which should work for authenticated users
-- But we need to ensure anonymous users can't access any data

-- Add explicit authentication requirement to profiles (defensive measure)
-- The current policy already does this via (id = auth.uid())

-- For extra safety, let's verify the current state and add explicit checks if needed
-- The existing RLS is restrictive, but let's ensure no anonymous fallback exists

-- Create a function to explicitly check authentication
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
$$;

-- Ensure analytics_events also requires authentication for clinic data
-- Current policies use is_clinic_member() which implicitly requires auth

-- The is_clinic_member function already checks auth.uid() internally,
-- so the existing RLS policies are secure for authenticated access.
-- The issue is that they are RESTRICTIVE (using "AS RESTRICTIVE") which means
-- they deny access by default. This is correct behavior.

-- Verify the security by examining: profiles and patients tables
-- Both use RESTRICTIVE policies that require auth.uid() checks.

-- The Supabase scanner may have flagged these because:
-- 1. No explicit DENY policy for anonymous users exists
-- 2. The policies are permissive but scoped to authenticated users

-- Let's add explicit check for authentication in profiles policy
-- by updating the existing policy to be clearer

-- First, drop the old policy
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Recreate with explicit auth check
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND id = auth.uid());

-- Update the update policy similarly
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() IS NOT NULL AND id = auth.uid())
WITH CHECK (auth.uid() IS NOT NULL AND id = auth.uid());

-- For patients table, the is_clinic_member function already requires authentication
-- but let's add an explicit auth check for extra security
DROP POLICY IF EXISTS "Members can view clinic patients" ON public.patients;

CREATE POLICY "Members can view clinic patients" 
ON public.patients 
FOR SELECT 
USING (auth.uid() IS NOT NULL AND is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "Members can create patients" ON public.patients;

CREATE POLICY "Members can create patients" 
ON public.patients 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "Members can update patients" ON public.patients;

CREATE POLICY "Members can update patients" 
ON public.patients 
FOR UPDATE 
USING (auth.uid() IS NOT NULL AND is_clinic_member(clinic_id))
WITH CHECK (auth.uid() IS NOT NULL AND is_clinic_member(clinic_id));

DROP POLICY IF EXISTS "Admins can delete patients" ON public.patients;

CREATE POLICY "Admins can delete patients" 
ON public.patients 
FOR DELETE 
USING (auth.uid() IS NOT NULL AND is_clinic_admin(clinic_id));
