-- ============================================================================
-- DENTACORE OS - PHASE 8: CLINICAL DECISION INTELLIGENCE
-- Migration: 20260212_phase8_clinical_intelligence
-- Purpose: Add behavioral intelligence and strategic decision layers
-- ============================================================================

-- 1. Enums for Decision Intelligence
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'urgency_level') THEN
        CREATE TYPE public.urgency_level AS ENUM ('emergency', 'soon', 'routine', 'low_priority');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'emotional_state') THEN
        CREATE TYPE public.emotional_state AS ENUM ('pain', 'fear', 'price_concern', 'casual', 'frustrated', 'confused', 'angry');
    END IF;
END $$;

-- 2. Patient Behavioral Profiles (Behavioral Memory)
CREATE TABLE IF NOT EXISTS public.patient_behavioral_profiles (
    patient_id UUID PRIMARY KEY REFERENCES public.patients(id) ON DELETE CASCADE,
    clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
    
    -- Intent & Behavioral Metrics
    last_urgency_level public.urgency_level DEFAULT 'routine',
    last_emotional_state public.emotional_state DEFAULT 'casual',
    
    booking_probability FLOAT DEFAULT 0.0, -- 0.0 to 1.0
    lifetime_value_potential DECIMAL(12,2) DEFAULT 0.0,
    cancellation_likelihood FLOAT DEFAULT 0.0,
    
    -- Preferences inferred by AI
    preferred_days TEXT[], -- ['Tuesday', 'Thursday']
    preferred_times TEXT[], -- ['Morning', 'Afternoon']
    
    -- Objection Memory
    common_objections TEXT[], -- ['Price', 'Fear']
    notes_behavioral TEXT,
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Strategic Slot Metadata (Augments pms_slots)
-- Allows the AI to know "why" it should offer a slot
CREATE TABLE IF NOT EXISTS public.slot_strategic_metadata (
    slot_id UUID PRIMARY KEY REFERENCES public.pms_slots(id) ON DELETE CASCADE,
    
    is_emergency_reserved BOOLEAN DEFAULT FALSE,
    is_high_value_preferred BOOLEAN DEFAULT FALSE,
    is_buffer_slot BOOLEAN DEFAULT FALSE, -- Used for risky patients
    
    demand_score INTEGER DEFAULT 0, -- 0-100 (e.g. 2pm Tuesday is 100, 7am Monday is 10)
    
    optimized_for_treatment_types TEXT[], -- ['Implant', 'Internal Revenue']
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Conversation Intent Log (Tracks decision tree progress)
CREATE TABLE IF NOT EXISTS public.conversation_intent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id UUID REFERENCES public.ai_calls(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    
    detected_urgency public.urgency_level,
    detected_emotion public.emotional_state,
    
    objection_detected TEXT, -- 'price', 'fear', 'time'
    ai_response_strategy TEXT, -- 'reassurance', 'discount_offer', 'soft_followup'
    
    booking_intent_score FLOAT, -- How sure are we they want to book?
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable RLS
ALTER TABLE public.patient_behavioral_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_strategic_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_intent_logs ENABLE ROW LEVEL SECURITY;

-- 6. Policies (Service role manages, members view)
CREATE POLICY "Service role manages behavioral profiles" ON public.patient_behavioral_profiles
    FOR ALL USING ( auth.role() = 'service_role' );
CREATE POLICY "Members view behavioral profiles" ON public.patient_behavioral_profiles
    FOR SELECT USING ( public.is_clinic_member(clinic_id) );

CREATE POLICY "Service role manages slot metadata" ON public.slot_strategic_metadata
    FOR ALL USING ( auth.role() = 'service_role' );
CREATE POLICY "Members view slot metadata" ON public.slot_strategic_metadata
    FOR SELECT USING ( TRUE ); -- Simplified for visibility

CREATE POLICY "Service role manages intent logs" ON public.conversation_intent_logs
    FOR ALL USING ( auth.role() = 'service_role' );
CREATE POLICY "Members view intent logs" ON public.conversation_intent_logs
    FOR SELECT USING ( TRUE );

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_behavioral_prob ON public.patient_behavioral_profiles(booking_probability DESC);
CREATE INDEX IF NOT EXISTS idx_intent_call_id ON public.conversation_intent_logs(call_id);
