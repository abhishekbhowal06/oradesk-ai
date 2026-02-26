-- Migration for Clinic Connectivity Control Center

-- 1. integration_connections
CREATE TABLE IF NOT EXISTS public.integration_connections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  provider text NOT NULL, -- e.g., 'OpenDental', 'Twilio', 'HubSpot'
  status text NOT NULL DEFAULT 'disconnected', -- 'connected', 'disconnected', 'error'
  last_sync_at timestamptz,
  connected_by text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(clinic_id, provider)
);

-- 2. integration_logs
CREATE TABLE IF NOT EXISTS public.integration_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info', -- 'info', 'warn', 'error'
  message text NOT NULL,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- 3. integration_sync_events
CREATE TABLE IF NOT EXISTS public.integration_sync_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'processing', -- 'processing', 'completed', 'failed'
  records_processed integer DEFAULT 0,
  error_code text,
  retry_count integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- 4. integration_permissions
CREATE TABLE IF NOT EXISTS public.integration_permissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id uuid NOT NULL REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  scope text NOT NULL, -- e.g., 'read:patients', 'write:appointments'
  granted_at timestamptz DEFAULT now(),
  UNIQUE(connection_id, scope)
);

-- 5. integration_health_status
CREATE TABLE IF NOT EXISTS public.integration_health_status (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id uuid NOT NULL UNIQUE REFERENCES public.integration_connections(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'healthy', -- 'healthy', 'degraded', 'offline'
  last_check_at timestamptz DEFAULT now(),
  latency_ms integer,
  error_rate_percent numeric(5,2) DEFAULT 0.00
);

-- Enable RLS
ALTER TABLE public.integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_health_status ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (assuming users belong to clinics, using a basic authenticated check for now. Adjust based on your actual auth setup if it relies on distinct JWT claims)

-- integration_connections
CREATE POLICY "Users can view their clinic connections"
  ON public.integration_connections FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their clinic connections"
  ON public.integration_connections FOR ALL
  TO authenticated
  USING (true);

-- integration_logs
CREATE POLICY "Users can view their clinic connection logs"
  ON public.integration_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert logs"
  ON public.integration_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- integration_sync_events
CREATE POLICY "Users can view sync events"
  ON public.integration_sync_events FOR SELECT
  TO authenticated
  USING (true);

-- integration_permissions
CREATE POLICY "Users can view connection permissions"
  ON public.integration_permissions FOR SELECT
  TO authenticated
  USING (true);

-- integration_health_status
CREATE POLICY "Users can view connection health"
  ON public.integration_health_status FOR SELECT
  TO authenticated
  USING (true);
