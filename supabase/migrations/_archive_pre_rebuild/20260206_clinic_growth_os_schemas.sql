-- ============================================================================
-- CLINIC GROWTH OS - BEHAVIORAL DATA SCHEMAS
-- Foundation for autonomous intelligence systems
-- ============================================================================

-- Patient Behavioral Profile
-- Tracks reliability, preferences, and patterns for autonomous decision-making
CREATE TABLE IF NOT EXISTS patient_behavioral_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    
    -- Reliability Scoring
    reliability_score INTEGER DEFAULT 50 CHECK (reliability_score >= 0 AND reliability_score <= 100),
    total_appointments INTEGER DEFAULT 0,
    completed_appointments INTEGER DEFAULT 0,
    no_show_count INTEGER DEFAULT 0,
    cancellation_count INTEGER DEFAULT 0,
    last_minute_cancellations INTEGER DEFAULT 0,
    
    -- Response Patterns
    avg_confirmation_response_time_hours DECIMAL(10,2),
    confirmation_rate DECIMAL(5,2) DEFAULT 0.00,
    prefers_text_over_call BOOLEAN DEFAULT TRUE,
    best_contact_time VARCHAR(20), -- 'morning', 'afternoon', 'evening'
    
    -- Financial Signals
    has_outstanding_balance BOOLEAN DEFAULT FALSE,
    payment_reliability_score INTEGER DEFAULT 50,
    insurance_verification_issues INTEGER DEFAULT 0,
    
    -- Engagement Signals
    family_booking_preference BOOLEAN DEFAULT FALSE, -- books for whole family at once
    flexible_schedule BOOLEAN DEFAULT FALSE, -- willing to take last-minute slots
    treatment_plan_acceptance_rate DECIMAL(5,2) DEFAULT 0.00,
    
    -- Seasonal Patterns
    preferred_day_of_week VARCHAR(20)[],
    preferred_time_of_day VARCHAR(20)[],
    seasonal_pattern JSONB, -- {winter: 0.8, spring: 1.2, summer: 0.9, fall: 1.1}
    
    -- Risk Indicators
    competitor_defection_risk_score INTEGER DEFAULT 0 CHECK (competitor_defection_risk_score >= 0 AND competitor_defection_risk_score <= 100),
    last_visit_satisfaction_score INTEGER,
    
    -- Metadata
    data_points_collected INTEGER DEFAULT 0, -- more data = higher confidence
    last_behavior_update_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(patient_id)
);

CREATE INDEX idx_patient_behavioral_reliability ON patient_behavioral_profiles(reliability_score);
CREATE INDEX idx_patient_behavioral_defection_risk ON patient_behavioral_profiles(competitor_defection_risk_score);
CREATE INDEX idx_patient_behavioral_flexible ON patient_behavioral_profiles(flexible_schedule) WHERE flexible_schedule = TRUE;

-- ============================================================================
-- Autonomous Event Log
-- Every AI action taken, with reasoning and outcome
-- ============================================================================
CREATE TABLE IF NOT EXISTS autonomous_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Context
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    patient_id UUID REFERENCES patients(id),
    appointment_id UUID REFERENCES appointments(id),
    
    -- Action Details
    action_type VARCHAR(100) NOT NULL, -- 'cancellation_prevention', 'no_show_prediction', 'reputation_shield', etc.
    action_taken TEXT NOT NULL,
    reasoning TEXT NOT NULL, -- "Why AI did this" for transparency
    confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
    
    -- Trigger
    triggered_by VARCHAR(100), -- 'schedule_gap_detected', 'patient_frustration_detected', 'revenue_below_target'
    trigger_data JSONB,
    
    -- Outcome
    outcome VARCHAR(50), -- 'success', 'failed', 'pending', 'overridden_by_human'
    outcome_data JSONB,
    business_impact_usd DECIMAL(10,2), -- measurable financial impact
    
    -- Human Feedback Loop
    human_override BOOLEAN DEFAULT FALSE,
    human_feedback TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Indexes for analysis
    CONSTRAINT valid_outcome CHECK (outcome IN ('success', 'failed', 'pending', 'overridden_by_human'))
);

CREATE INDEX idx_autonomous_actions_clinic ON autonomous_actions(clinic_id, created_at DESC);
CREATE INDEX idx_autonomous_actions_type ON autonomous_actions(action_type);
CREATE INDEX idx_autonomous_actions_outcome ON autonomous_actions(outcome);
CREATE INDEX idx_autonomous_actions_impact ON autonomous_actions(business_impact_usd) WHERE business_impact_usd IS NOT NULL;

-- ============================================================================
-- Schedule Health Monitoring
-- Real-time tracking of clinic schedule state for autonomous optimization
-- ============================================================================
CREATE TABLE IF NOT EXISTS schedule_health_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    snapshot_date DATE NOT NULL,
    
    -- Current State
    total_slots INTEGER NOT NULL,
    booked_slots INTEGER NOT NULL,
    cancelled_slots INTEGER NOT NULL,
    no_show_risk_slots INTEGER DEFAULT 0, -- slots with high no-show probability
    
    -- Revenue Tracking
    projected_revenue_usd DECIMAL(10,2),
    actual_revenue_usd DECIMAL(10,2),
    target_revenue_usd DECIMAL(10,2),
    revenue_variance_percent DECIMAL(5,2),
    
    -- Health Metrics
    schedule_density_percent DECIMAL(5,2), -- how full is schedule
    schedule_quality_score INTEGER, -- balance of profitable vs filler appointments
    emergency_slot_availability INTEGER,
    
    -- AI Actions
    autonomous_fills_count INTEGER DEFAULT 0, -- how many slots AI filled today
    autonomous_optimizations_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(clinic_id, snapshot_date)
);

CREATE INDEX idx_schedule_health_clinic_date ON schedule_health_snapshots(clinic_id, snapshot_date DESC);

-- ============================================================================
-- Treatment Plan Pipeline
-- Tracks pending treatments like sales pipeline for persistence engine
-- ============================================================================
CREATE TABLE IF NOT EXISTS treatment_plan_pipeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    patient_id UUID NOT NULL REFERENCES patients(id),
    dentist_id UUID NOT NULL REFERENCES staff(id),
    
    -- Treatment Details
    procedure_name VARCHAR(255) NOT NULL,
    estimated_cost_usd DECIMAL(10,2) NOT NULL,
    urgency VARCHAR(20) DEFAULT 'routine', -- 'urgent', 'routine', 'elective'
    
    -- Pipeline Stage
    stage VARCHAR(50) DEFAULT 'proposed', -- 'proposed', 'patient_thinking', 'follow_up_sent', 'accepted', 'declined', 'dead'
    stage_updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- AI Engagement Tracking
    ai_follow_ups_sent INTEGER DEFAULT 0,
    last_ai_contact_at TIMESTAMPTZ,
    next_ai_contact_at TIMESTAMPTZ,
    
    -- Patient Signals
    patient_expressed_interest BOOLEAN DEFAULT FALSE,
    patient_mentioned_cost_concern BOOLEAN DEFAULT FALSE,
    patient_requested_financing BOOLEAN DEFAULT FALSE,
    
    -- Outcome
    conversion_probability INTEGER, -- AI-calculated likelihood of acceptance
    converted_at TIMESTAMPTZ,
    declined_at TIMESTAMPTZ,
    decline_reason TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_stage CHECK (stage IN ('proposed', 'patient_thinking', 'follow_up_sent', 'accepted', 'declined', 'dead')),
    CONSTRAINT valid_urgency CHECK (urgency IN ('urgent', 'routine', 'elective'))
);

CREATE INDEX idx_treatment_pipeline_clinic ON treatment_plan_pipeline(clinic_id, stage);
CREATE INDEX idx_treatment_pipeline_patient ON treatment_plan_pipeline(patient_id);
CREATE INDEX idx_treatment_pipeline_next_contact ON treatment_plan_pipeline(next_ai_contact_at) WHERE stage NOT IN ('accepted', 'declined', 'dead');

-- ============================================================================
-- Revenue Stability Tracking
-- Historical revenue patterns for forecasting and stabilization
-- ============================================================================
CREATE TABLE IF NOT EXISTS revenue_stability_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    
    -- Time Period
    period_type VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    -- Revenue Data
    actual_revenue_usd DECIMAL(10,2) NOT NULL,
    target_revenue_usd DECIMAL(10,2) NOT NULL,
    variance_usd DECIMAL(10,2) NOT NULL,
    variance_percent DECIMAL(5,2) NOT NULL,
    
    -- AI Interventions
    ai_filled_revenue_usd DECIMAL(10,2) DEFAULT 0.00,
    ai_prevented_loss_usd DECIMAL(10,2) DEFAULT 0.00,
    
    -- Pattern Analysis
    day_of_week VARCHAR(20),
    is_holiday BOOLEAN DEFAULT FALSE,
    weather_impact BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_period CHECK (period_type IN ('daily', 'weekly', 'monthly'))
);

CREATE INDEX idx_revenue_stability_clinic ON revenue_stability_metrics(clinic_id, period_start DESC);

-- ============================================================================
-- Reputation Crisis Events
-- Tracks potential reputation risks for proactive intervention
-- ============================================================================
CREATE TABLE IF NOT EXISTS reputation_crisis_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Context
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    patient_id UUID REFERENCES patients(id),
    call_id UUID REFERENCES ai_calls(id),
    
    -- Detection
    crisis_type VARCHAR(50) NOT NULL, -- 'angry_patient', 'long_wait', 'billing_dispute', 'medical_concern'
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Signals
    voice_anger_score INTEGER, -- 0-100 from speech analysis
    negative_keywords TEXT[],
    patient_threat_to_leave BOOLEAN DEFAULT FALSE,
    review_risk_score INTEGER, -- 0-100 likelihood of negative review
    
    -- AI Response
    ai_action_taken VARCHAR(100), -- 'escalated_to_doctor', 'transferred_to_senior_staff', 'offered_callback'
    escalated_to_human BOOLEAN DEFAULT FALSE,
    escalation_response_time_seconds INTEGER,
    
    -- Resolution
    resolved BOOLEAN DEFAULT FALSE,
    resolution_outcome VARCHAR(50), -- 'patient_satisfied', 'partial_resolution', 'patient_left', 'review_posted'
    prevented_negative_review BOOLEAN,
    
    -- Business Impact
    estimated_ltv_at_risk_usd DECIMAL(10,2),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    
    CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

CREATE INDEX idx_reputation_events_clinic ON reputation_crisis_events(clinic_id, detected_at DESC);
CREATE INDEX idx_reputation_events_unresolved ON reputation_crisis_events(resolved) WHERE resolved = FALSE;

-- ============================================================================
-- Family Network Mapping
-- Tracks family relationships for family booking patterns
-- ============================================================================
CREATE TABLE IF NOT EXISTS patient_family_networks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Family Grouping
    family_id UUID NOT NULL, -- shared across family members
    patient_id UUID NOT NULL REFERENCES patients(id),
    
    -- Relationships
    relationship_to_primary VARCHAR(50), -- 'self', 'spouse', 'child', 'parent', 'sibling'
    primary_family_member_id UUID REFERENCES patients(id),
    
    -- Booking Patterns
    typically_books_together BOOLEAN DEFAULT FALSE,
    prefers_same_day_appointments BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(patient_id)
);

CREATE INDEX idx_family_networks_family ON patient_family_networks(family_id);
CREATE INDEX idx_family_networks_books_together ON patient_family_networks(family_id) WHERE typically_books_together = TRUE;

-- ============================================================================
-- Staff Burnout Monitoring
-- Tracks staff workload and stress signals
-- ============================================================================
CREATE TABLE IF NOT EXISTS staff_burnout_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Staff Member
    staff_id UUID NOT NULL REFERENCES staff(id),
    clinic_id UUID NOT NULL REFERENCES clinics(id),
    
    -- Workload Metrics
    date DATE NOT NULL,
    calls_handled INTEGER DEFAULT 0,
    difficult_calls_count INTEGER DEFAULT 0,
    avg_call_handle_time_seconds INTEGER,
    transfers_to_doctor INTEGER DEFAULT 0,
    
    -- Stress Signals
    fatigue_score INTEGER, -- 0-100 calculated from patterns
    emotional_exhaustion_signals INTEGER DEFAULT 0,
    
    -- AI Interventions
    ai_took_over_calls INTEGER DEFAULT 0,
    easy_calls_routed_to_staff INTEGER DEFAULT 0, -- AI gives breaks by routing easy ones
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(staff_id, date)
);

CREATE INDEX idx_staff_burnout_staff ON staff_burnout_metrics(staff_id, date DESC);
CREATE INDEX idx_staff_burnout_high_fatigue ON staff_burnout_metrics(fatigue_score) WHERE fatigue_score > 70;

-- ============================================================================
-- Views for Quick Analysis
-- ============================================================================

-- High-risk no-show appointments (for proactive intervention)
CREATE OR REPLACE VIEW high_risk_no_show_appointments AS
SELECT 
    a.id AS appointment_id,
    a.clinic_id,
    a.patient_id,
    a.scheduled_at,
    p.phone AS patient_phone,
    pbp.reliability_score,
    pbp.no_show_count,
    (100 - pbp.reliability_score) AS no_show_probability
FROM appointments a
JOIN patient_behavioral_profiles pbp ON a.patient_id = pbp.patient_id
JOIN patients p ON a.patient_id = p.id
WHERE a.status = 'scheduled'
    AND a.scheduled_at > NOW()
    AND pbp.reliability_score < 60
ORDER BY pbp.reliability_score ASC, a.scheduled_at ASC;

-- Revenue at risk from cancellations
CREATE OR REPLACE VIEW revenue_at_risk_today AS
SELECT 
    clinic_id,
    COUNT(*) AS risky_appointments,
    SUM(estimated_cost) AS revenue_at_risk_usd
FROM high_risk_no_show_appointments
WHERE DATE(scheduled_at) = CURRENT_DATE
GROUP BY clinic_id;

-- Treatment plans ready for AI follow-up
CREATE OR REPLACE VIEW treatment_plans_ready_for_followup AS
SELECT 
    tpp.*,
    p.phone AS patient_phone,
    p.email AS patient_email,
    pbp.treatment_plan_acceptance_rate
FROM treatment_plan_pipeline tpp
JOIN patients p ON tpp.patient_id = p.id
LEFT JOIN patient_behavioral_profiles pbp ON tpp.patient_id = pbp.patient_id
WHERE tpp.stage IN ('patient_thinking', 'follow_up_sent')
    AND (tpp.next_ai_contact_at IS NULL OR tpp.next_ai_contact_at <= NOW())
    AND tpp.created_at > NOW() - INTERVAL '90 days'
ORDER BY tpp.estimated_cost_usd DESC;

COMMENT ON TABLE patient_behavioral_profiles IS 'Behavioral intelligence for each patient - drives autonomous decision-making';
COMMENT ON TABLE autonomous_actions IS 'Audit trail of all AI autonomous actions with reasoning and outcomes';
COMMENT ON TABLE schedule_health_snapshots IS 'Real-time schedule state for revenue optimization';
COMMENT ON TABLE treatment_plan_pipeline IS 'Sales pipeline for treatment persistence engine';
COMMENT ON TABLE revenue_stability_metrics IS 'Historical revenue patterns for forecasting';
COMMENT ON TABLE reputation_crisis_events IS 'Early warning system for reputation risks';
COMMENT ON TABLE patient_family_networks IS 'Family relationship mapping for intelligent booking';
COMMENT ON TABLE staff_burnout_metrics IS 'Staff workload monitoring for burnout prevention';
