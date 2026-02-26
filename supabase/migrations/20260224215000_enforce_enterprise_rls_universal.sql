-- =========================================================================================
-- ENTERPRISE TECHNICAL AUDIT REMEDIATION
-- Phase 1 - Step 1: Enforce Row Level Security (RLS) Universally
-- 
-- Description:
--   During the CTO Audit, multiple tables were found to either entirely lack RLS,
--   or contain broken RLS policies (e.g. referencing `profiles` instead of `staff_memberships`).
--   This script forces ENABLE ROW LEVEL SECURITY on all tenant tables and applies a
--   single, optimized, bulletproof policy function mapping auth.uid() -> staff_memberships.
-- =========================================================================================

-- 1. Create a universally optimized authorization function
--    SECURITY DEFINER allows this function to bypass RLS to lookup the membership, preventing infinite loops.
CREATE OR REPLACE FUNCTION public.user_belongs_to_clinic(check_clinic_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.staff_memberships 
    WHERE user_id = auth.uid() AND clinic_id = check_clinic_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Drop any existing fragmented, broken policies from previous migrations
DO $$ 
DECLARE 
    tbl VARCHAR;
    pol record;
    tables_to_secure VARCHAR[] := ARRAY[
        'patients', 'appointments', 'campaigns', 'outreach_jobs', 'recall_candidates',
        'patient_behavioral_profiles', 'slot_strategic_metadata', 'conversation_intent_logs',
        'documents', 'leads', 'clinic_calendar_connections', 'calendar_sync_log',
        'follow_up_tasks', 'bridge_devices', 'pms_entity_map', 'pms_write_queue',
        'pms_bridge_audit_log', 'pms_field_mappings', 'integration_connections',
        'integration_logs', 'integration_sync_events', 'integration_permissions',
        'integration_health_status'
    ];
BEGIN 
    -- Nuke old policies
    FOR pol IN 
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = ANY(tables_to_secure)
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;

    -- Apply the unified secure policy
    FOREACH tbl IN ARRAY tables_to_secure LOOP
        -- Ensure RLS is enabled unconditionally
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
        
        -- Create the universal policy utilizing our high-performance function
        EXECUTE format('
            CREATE POLICY "Universal Enterprise Clinic Isolation" ON public.%I
            FOR ALL
            USING (public.user_belongs_to_clinic(clinic_id))
            WITH CHECK (public.user_belongs_to_clinic(clinic_id));
        ', tbl);
    END LOOP;
END $$;

-- 3. Lock down global settings tables that shouldn't be touched randomly
ALTER TABLE public.pms_field_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "System Read Only pms_field_mappings" ON public.pms_field_mappings;
CREATE POLICY "System Read Only pms_field_mappings" ON public.pms_field_mappings
    FOR SELECT USING (true);
