-- Operations Reliability: Escalation Tracking
-- Adds columns for tracking escalation handling

-- Add escalation handling columns to ai_calls
ALTER TABLE ai_calls
ADD COLUMN IF NOT EXISTS escalation_handled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS escalation_handled_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS escalation_resolution TEXT;

-- Create index for finding unhandled escalations
CREATE INDEX IF NOT EXISTS idx_unhandled_escalations 
ON ai_calls(clinic_id, escalation_required, escalation_handled_at) 
WHERE escalation_required = true AND escalation_handled_at IS NULL;

-- Staff Tasks table for human intervention workflows
CREATE TABLE IF NOT EXISTS staff_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'dismissed')),
    
    -- Related entities
    related_patient_id UUID REFERENCES patients(id),
    related_call_id UUID REFERENCES ai_calls(id),
    related_appointment_id UUID REFERENCES appointments(id),
    
    -- Tracking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_to UUID REFERENCES auth.users(id),
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES auth.users(id),
    
    -- Notes
    resolution_notes TEXT
);

-- Index for fetching pending tasks
CREATE INDEX IF NOT EXISTS idx_pending_staff_tasks
ON staff_tasks(clinic_id, status, priority)
WHERE status = 'pending';

-- Enable RLS
ALTER TABLE staff_tasks ENABLE ROW LEVEL SECURITY;

-- Policy: Clinic can manage their own tasks
CREATE POLICY "Clinics manage own tasks" ON staff_tasks
    FOR ALL
    USING (clinic_id IN (
        SELECT clinic_id FROM profiles WHERE user_id = auth.uid()
    ));

-- Comments
COMMENT ON TABLE staff_tasks IS 'Staff action items created by AI escalations and system failures';
COMMENT ON COLUMN ai_calls.escalation_handled_at IS 'When a staff member addressed the escalation';
COMMENT ON COLUMN ai_calls.escalation_handled_by IS 'Staff member who handled the escalation';
