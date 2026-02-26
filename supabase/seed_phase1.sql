-- ============================================================================
-- DENTACORE OS - PHASE 1: FOUNDATION SEED DATA
-- Purpose: Populate database with realistic test data for development
-- Apply this AFTER migration 20260210_phase1_foundation.sql
-- ============================================================================

-- 1. Create a Test Clinic
DO $$
DECLARE
    clinic_id UUID;
    admin_id UUID;
    recep_id UUID;
    p1_id UUID; p2_id UUID; p3_id UUID; p4_id UUID; p5_id UUID;
    camp_id UUID;
    job_id UUID;
BEGIN
    -- Insert Clinic
    INSERT INTO public.clinics (name, phone, email, timezone, working_hours, ai_settings)
    VALUES (
        'Dental One Center',
        '+15550101000',
        'contact@dentalone.fake',
        'America/New_York',
        '{"monday": {"start": "09:00", "end": "17:00"}, "tuesday": {"start": "09:00", "end": "17:00"}}',
        '{"confirmation_calls_enabled": true}'
    ) RETURNING id INTO clinic_id;

    -- Insert Staff Profiles (Fake auth users)
    -- Admin
    admin_id := gen_random_uuid();
    INSERT INTO auth.users (id, email) VALUES (admin_id, 'admin@dentalone.fake'); -- Mock auth user
    INSERT INTO public.profiles (id, email, full_name) VALUES (admin_id, 'admin@dentalone.fake', 'Dr. Smith (Admin)');
    INSERT INTO public.staff_memberships (clinic_id, user_id, role) VALUES (clinic_id, admin_id, 'admin');

    -- Receptionist
    recep_id := gen_random_uuid();
    INSERT INTO auth.users (id, email) VALUES (recep_id, 'frontdesk@dentalone.fake'); -- Mock auth user
    INSERT INTO public.profiles (id, email, full_name) VALUES (recep_id, 'frontdesk@dentalone.fake', 'Sara Receptionist');
    INSERT INTO public.staff_memberships (clinic_id, user_id, role) VALUES (clinic_id, recep_id, 'receptionist');

    -- Insert Patients
    -- Patient 1: High Value Recall (Overdue 9 months)
    INSERT INTO public.patients (clinic_id, first_name, last_name, phone, email, last_visit, status)
    VALUES (clinic_id, 'John', 'Doe', '+15550102001', 'john@fake.com', CURRENT_DATE - INTERVAL '9 months', 'active')
    RETURNING id INTO p1_id;

    -- Patient 2: Recent Visit (No recall needed)
    INSERT INTO public.patients (clinic_id, first_name, last_name, phone, email, last_visit, status)
    VALUES (clinic_id, 'Jane', 'Smith', '+15550102002', 'jane@fake.com', CURRENT_DATE - INTERVAL '1 month', 'active')
    RETURNING id INTO p2_id;

    -- Patient 3: Medium Value (Overdue 7 months)
    INSERT INTO public.patients (clinic_id, first_name, last_name, phone, email, last_visit, status)
    VALUES (clinic_id, 'Bob', 'Jones', '+15550102003', 'bob@fake.com', CURRENT_DATE - INTERVAL '7 months', 'active')
    RETURNING id INTO p3_id;

    -- Patient 4: Deceased/DNC
    INSERT INTO public.patients (clinic_id, first_name, last_name, phone, email, last_visit, status)
    VALUES (clinic_id, 'Alice', 'Ghost', '+15550102004', 'alice@fake.com', CURRENT_DATE - INTERVAL '12 months', 'inactive')
    RETURNING id INTO p4_id;

    -- Patient 5: High Value (Implants needed)
    INSERT INTO public.patients (clinic_id, first_name, last_name, phone, email, last_visit, status)
    VALUES (clinic_id, 'Vip', 'Patient', '+15550102005', 'vip@fake.com', CURRENT_DATE - INTERVAL '8 months', 'active')
    RETURNING id INTO p5_id;


    -- Insert Recall Candidates (Derived from logic simulated here)
    -- Candidate 1 (John Doe)
    INSERT INTO public.recall_candidates (clinic_id, patient_id, last_visit_date, estimated_value, priority_score, priority_level, status)
    VALUES (clinic_id, p1_id, CURRENT_DATE - INTERVAL '9 months', 1500.00, 85, 'high', 'pending');

    -- Candidate 2 (Bob Jones) - Already in campaign
    INSERT INTO public.recall_candidates (clinic_id, patient_id, last_visit_date, estimated_value, priority_score, priority_level, status)
    VALUES (clinic_id, p3_id, CURRENT_DATE - INTERVAL '7 months', 200.00, 45, 'medium', 'in_campaign');

    -- Candidate 3 (Vip Patient) - High Value
    INSERT INTO public.recall_candidates (clinic_id, patient_id, last_visit_date, estimated_value, priority_score, priority_level, status)
    VALUES (clinic_id, p5_id, CURRENT_DATE - INTERVAL '8 months', 5000.00, 95, 'critical', 'pending');


    -- Insert Campaigns
    -- Campaign 1: Monthly Hygiene Recall (Running)
    INSERT INTO public.campaigns (clinic_id, name, description, status, outreach_channel, created_by)
    VALUES (clinic_id, 'Feb 2026 Hygiene Recall', 'Standard cleaning reminders', 'running', '{voice, sms}', admin_id)
    RETURNING id INTO camp_id;

    -- Campaign 2: Implant Promo (Draft)
    INSERT INTO public.campaigns (clinic_id, name, description, status, outreach_channel, created_by)
    VALUES (clinic_id, 'Implant Promo Q1', 'Targeting high value patients', 'draft', '{email}', admin_id);


    -- Insert Outreach Jobs (Linked to Campaign 1)
    -- Job 1: Pending for Bob Jones
    INSERT INTO public.outreach_jobs (clinic_id, campaign_id, patient_id, status, channel, scheduled_for, attempt_count)
    VALUES (clinic_id, camp_id, p3_id, 'pending', 'voice', NOW() + INTERVAL '1 hour', 0);

    -- Job 2: Completed for John Doe (Fake history)
    INSERT INTO public.outreach_jobs (clinic_id, campaign_id, patient_id, status, channel, scheduled_for, attempt_count, outcome_summary)
    VALUES (clinic_id, camp_id, p1_id, 'completed', 'voice', NOW() - INTERVAL '2 hours', 1, 'Patient answered, booked appt');


    -- Insert Completed AI Call (John Doe)
    INSERT INTO public.ai_calls (clinic_id, patient_id, phone_number, call_type, status, outcome, duration_seconds, transcript)
    VALUES (clinic_id, p1_id, '+15550102001', 'recall', 'completed', 'confirmed', 120, '{"user": "Yes book me", "ai": "Great"}');

    
    -- Insert Lead Queue
    -- Lead 1: John Doe (Booked)
    INSERT INTO public.lead_queue (clinic_id, patient_id, source_campaign_id, status, priority, ai_summary, assigned_to)
    VALUES (clinic_id, p1_id, camp_id, 'booked', 'high', 'Patient requested cleaning next Tuesday', recep_id);

    -- Lead 2: Vip Patient (New)
    INSERT INTO public.lead_queue (clinic_id, patient_id, source_campaign_id, status, priority, ai_summary)
    VALUES (clinic_id, p5_id, camp_id, 'new', 'critical', 'Detected high value opportunity manually');


    -- Insert Appointment (John Doe)
    INSERT INTO public.appointments (clinic_id, patient_id, scheduled_at, procedure_name, status, notes)
    VALUES (clinic_id, p1_id, NOW() + INTERVAL '2 days', 'Adult Prophy', 'scheduled', 'Booked via AI');


    -- Insert Revenue Attribution
    INSERT INTO public.revenue_attribution (clinic_id, appointment_id, patient_id, source_type, campaign_id, status, estimated_value)
    VALUES (clinic_id, (SELECT id FROM public.appointments WHERE patient_id = p1_id LIMIT 1), p1_id, 'ai_outreach', camp_id, 'pending', 150.00);


    -- Insert PMS Sync State
    INSERT INTO public.pms_sync_state (clinic_id, pms_software, connection_type, sync_status, patients_synced)
    VALUES (clinic_id, 'OpenDental', 'local_agent', 'ok', 1450);

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error seeding data: %', SQLERRM;
END $$;
