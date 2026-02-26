-- =========================================================================================
-- ENTERPRISE TECHNICAL AUDIT REMEDIATION
-- Phase 1 - Step 3: Webhook Idempotency
-- 
-- Description:
--   Creates a high-performance track list of processed webhook events (Stripe, Twilio, Vapi)
--   to ensure duplicate asynchronous events never cause double-charges or double-bookings.
-- =========================================================================================

CREATE TABLE IF NOT EXISTS public.processed_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL CHECK (provider IN ('stripe', 'twilio', 'vapi', 'calendar', 'pms')),
    event_id TEXT NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Composite unique constraint crucial for idempotency
    UNIQUE(provider, event_id)
);

-- Note: We intentionally do NOT enable RLS on this table because it is accessed strictly
-- via service-role backend logic (Express), and no patient or sub-tenant should ever read it.

-- Create an index to quickly purge old idempotency keys later (e.g., records > 30 days)
CREATE INDEX idx_processed_webhooks_date ON public.processed_webhooks (processed_at);
