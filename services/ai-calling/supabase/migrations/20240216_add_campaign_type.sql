-- Create follow_up_schedules table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.follow_up_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL, -- Assuming relation exists, or just UUID
    patient_id UUID NOT NULL, -- Assuming relation exists
    appointment_id UUID,
    campaign_type TEXT DEFAULT 'default',
    attempt_number INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    status TEXT DEFAULT 'pending', -- pending, completed, exhausted, cancelled
    next_attempt_at TIMESTAMP WITH TIME ZONE, -- Using next_attempt_at as the driver
    last_attempt_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Legacy support if needed, or we just map to next_attempt_at
    scheduled_for TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.follow_up_schedules ENABLE ROW LEVEL SECURITY;

-- Policy
CREATE POLICY "Enable read for authenticated users only" ON public.follow_up_schedules
    FOR SELECT USING (auth.role() = 'service_role');

-- If table already existed but missing campaign_type (idempotent check)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follow_up_schedules' AND column_name = 'campaign_type') THEN
        ALTER TABLE public.follow_up_schedules ADD COLUMN campaign_type TEXT DEFAULT 'default';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'follow_up_schedules' AND column_name = 'next_attempt_at') THEN
        ALTER TABLE public.follow_up_schedules ADD COLUMN next_attempt_at TIMESTAMP WITH TIME ZONE;
        -- Migrate data if needed
        UPDATE public.follow_up_schedules SET next_attempt_at = scheduled_for WHERE next_attempt_at IS NULL;
    END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_follow_up_schedules_next_attempt 
ON public.follow_up_schedules(next_attempt_at) 
WHERE status = 'pending';

-- Foreign keys (optional, good for integrity if tables exist)
-- ALTER TABLE public.follow_up_schedules ADD CONSTRAINT fk_clinic FOREIGN KEY (clinic_id) REFERENCES public.clinics(id);
-- ALTER TABLE public.follow_up_schedules ADD CONSTRAINT fk_patient FOREIGN KEY (patient_id) REFERENCES public.patients(id);
