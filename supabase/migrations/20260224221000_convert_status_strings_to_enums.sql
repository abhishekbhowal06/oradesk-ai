-- Convert standard text/varchar status columns into explicit PostgreSQL ENUMs

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'patient_status') THEN
        CREATE TYPE public.patient_status AS ENUM ('active', 'inactive', 'unreachable');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_connection_status') THEN
        CREATE TYPE public.integration_connection_status AS ENUM ('connected', 'disconnected', 'error');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_log_status') THEN
        CREATE TYPE public.integration_log_status AS ENUM ('processing', 'completed', 'failed');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'integration_health_state') THEN
        CREATE TYPE public.integration_health_state AS ENUM ('healthy', 'degraded', 'offline');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pms_sync_state_status') THEN
        CREATE TYPE public.pms_sync_state_status AS ENUM ('ok', 'error', 'disconnected');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recall_candidate_status') THEN
        CREATE TYPE public.recall_candidate_status AS ENUM ('pending', 'in_campaign', 'booked', 'snoozed', 'do_not_contact');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bridge_job_status') THEN
        CREATE TYPE public.bridge_job_status AS ENUM ('pending', 'claimed', 'executing', 'completed', 'failed', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bridge_sync_status') THEN
        CREATE TYPE public.bridge_sync_status AS ENUM ('success', 'partial', 'failed', 'conflict');
    END IF;
END $$;

-- 1. patients
ALTER TABLE IF EXISTS public.patients 
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.patient_status USING status::public.patient_status,
  ALTER COLUMN status SET DEFAULT 'active';

-- 2. recall_candidates
ALTER TABLE IF EXISTS public.recall_candidates
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.recall_candidate_status USING status::public.recall_candidate_status,
  ALTER COLUMN status SET DEFAULT 'pending';

-- 3. integration_connections
ALTER TABLE IF EXISTS public.integration_connections
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.integration_connection_status USING status::public.integration_connection_status,
  ALTER COLUMN status SET DEFAULT 'disconnected';

-- 4. integration_logs
ALTER TABLE IF EXISTS public.integration_logs
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.integration_log_status USING status::public.integration_log_status,
  ALTER COLUMN status SET DEFAULT 'processing';

-- 5. integration_health_status
ALTER TABLE IF EXISTS public.integration_health_status
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.integration_health_state USING status::public.integration_health_state,
  ALTER COLUMN status SET DEFAULT 'healthy';

-- 6. pms_sync_state
ALTER TABLE IF EXISTS public.pms_sync_state
  ALTER COLUMN sync_status DROP DEFAULT,
  ALTER COLUMN sync_status TYPE public.pms_sync_state_status USING sync_status::public.pms_sync_state_status,
  ALTER COLUMN sync_status SET DEFAULT 'ok';

-- 7. bridge_jobs
ALTER TABLE IF EXISTS public.bridge_jobs
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.bridge_job_status USING status::public.bridge_job_status,
  ALTER COLUMN status SET DEFAULT 'pending';

-- 8. bridge_sync_results
ALTER TABLE IF EXISTS public.bridge_sync_results
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.bridge_sync_status USING status::public.bridge_sync_status,
  ALTER COLUMN status SET DEFAULT 'success';

-- 9. pms_write_queue
ALTER TABLE IF EXISTS public.pms_write_queue
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE public.bridge_job_status USING status::public.bridge_job_status,
  ALTER COLUMN status SET DEFAULT 'pending';
