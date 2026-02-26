-- =========================================================================================
-- ENTERPRISE TECHNICAL AUDIT REMEDIATION
-- Phase 2 - Step 5: Composite Database Indexes
-- 
-- Description:
--   The CTO Audit identified that tables like `ai_calls`, `integration_logs`, and 
--   `appointments` would suffer severely from N+1 query speeds as data grows because
--   they lacked composite index structures common to B2B dashboard filtering.
-- =========================================================================================

-- 1. AI Calls Table
-- Dashboard queries: "Show me all 'completed' calls for my clinic in the last 7 days"
CREATE INDEX IF NOT EXISTS idx_ai_calls_clinic_status_date 
ON public.ai_calls (clinic_id, status, created_at DESC);

-- Outreach Jobs Table
-- Dashboard queries: "Show me all 'pending' or 'failed' jobs for this campaign"
CREATE INDEX IF NOT EXISTS idx_outreach_jobs_campaign_status 
ON public.outreach_jobs (campaign_id, status);

-- Appointments Table
-- Calendar queries: "Show me all appointments for my clinic between Date X and Date Y"
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_date 
ON public.appointments (clinic_id, scheduled_at);

-- Integration Logs Table
-- Debug queries: "Show me 'failed' logs for 'stripe' for my clinic"
CREATE INDEX IF NOT EXISTS idx_integration_logs_clinic_provider_status 
ON public.integration_logs (clinic_id, provider, status, created_at DESC);

-- Campaigns Table
-- Dashboard queries: "Show me 'active' campaigns for my clinic"
CREATE INDEX IF NOT EXISTS idx_campaigns_clinic_status 
ON public.campaigns (clinic_id, status);

-- Patients Table
-- Search queries: Search patient by name or phone within a specific clinic
CREATE INDEX IF NOT EXISTS idx_patients_clinic_search 
ON public.patients (clinic_id, last_name, first_name);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_phone 
ON public.patients (clinic_id, phone);

-- Leads Table
-- Pipeline queries: "Show me 'new' or 'contacted' leads sorted by priority"
CREATE INDEX IF NOT EXISTS idx_leads_clinic_status_priority 
ON public.leads (clinic_id, status, priority);
