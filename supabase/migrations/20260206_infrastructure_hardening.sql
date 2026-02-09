-- DISTRIBUTED LOCKS TABLE
-- Used to prevent race conditions in autonomous engines

CREATE TABLE IF NOT EXISTS distributed_locks (
    lock_key TEXT PRIMARY KEY,
    holder_id TEXT NOT NULL,
    acquired_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- CLINIC YIELD CONFIGURATION TABLE
-- Per-clinic settings for the Yield Optimizer engine

CREATE TABLE IF NOT EXISTS clinic_yield_config (
    clinic_id UUID PRIMARY KEY REFERENCES clinics(id) ON DELETE CASCADE,
    prime_time_start TIME DEFAULT '08:00:00',
    prime_time_end TIME DEFAULT '10:00:00',
    secondary_prime_start TIME DEFAULT '16:00:00',
    secondary_prime_end TIME DEFAULT '18:00:00',
    high_value_threshold NUMERIC(10,2) DEFAULT 250.00,
    daily_goal NUMERIC(10,2) DEFAULT 5000.00,
    revenue_rescue_percent NUMERIC(5,2) DEFAULT 50.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add timezone column to clinics table
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- Index for faster lock cleanup
CREATE INDEX IF NOT EXISTS idx_distributed_locks_expires ON distributed_locks(expires_at);

-- COMMENTS (Documentation)
COMMENT ON TABLE distributed_locks IS 'Prevents race conditions when multiple server instances run autonomous engines';
COMMENT ON TABLE clinic_yield_config IS 'Per-clinic configuration for the Yield Optimizer engine';
COMMENT ON COLUMN clinics.timezone IS 'IANA timezone identifier for clinic local time';
