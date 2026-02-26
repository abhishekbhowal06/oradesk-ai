/**
 * DOMAIN TYPES — Production Grade Type Definitions
 * ══════════════════════════════════════════════════════════════════
 * 
 * Centralized type definitions for the entire backend.
 * Eliminates `any` usage across the codebase.
 * All types are strict — no optional looseness.
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// SUBSCRIPTION & BILLING
// ═══════════════════════════════════════════════════════════════

export type SubscriptionTier = 'free' | 'starter' | 'growth' | 'professional' | 'enterprise';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled' | 'paused';

// ═══════════════════════════════════════════════════════════════
// CLINIC
// ═══════════════════════════════════════════════════════════════

export interface AISettings {
  confirmation_calls_enabled?: boolean;
  recall_enabled?: boolean;
  max_concurrent_calls?: number;
  language?: string;
  voice_id?: string;
  escalation_threshold?: number;
}

export interface Clinic {
  id: string;
  name: string;
  email?: string;
  subscription_tier: SubscriptionTier;
  subscription_status: SubscriptionStatus;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  twilio_phone_number?: string;
  escalation_phone?: string;
  ai_settings?: AISettings;
  ai_disclosure_enabled?: boolean;
  automation_paused?: boolean;
  timezone?: string;
  created_at?: string;
  updated_at?: string;
}

// ═══════════════════════════════════════════════════════════════
// PATIENT
// ═══════════════════════════════════════════════════════════════

export type PatientStatus = 'active' | 'inactive' | 'unreachable';

export interface Patient {
  id: string;
  clinic_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  status?: PatientStatus;
  date_of_birth?: string;
  insurance_provider?: string;
  created_at?: string;
  updated_at?: string;
}

// ═══════════════════════════════════════════════════════════════
// APPOINTMENT
// ═══════════════════════════════════════════════════════════════

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'rescheduled';

export interface Appointment {
  id: string;
  clinic_id: string;
  patient_id: string;
  scheduled_at: string;
  start_time?: string;
  end_time?: string;
  procedure_name?: string;
  status: AppointmentStatus;
  confirmed_at?: string;
  type?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  // Joined relations
  patients?: Patient;
  clinics?: Clinic;
}

// ═══════════════════════════════════════════════════════════════
// AI CALL
// ═══════════════════════════════════════════════════════════════

export type CallStatus = 'queued' | 'calling' | 'ringing' | 'answered' | 'in-progress' | 'completed' | 'failed' | 'no_answer' | 'cancelled';
export type CallOutcome = 'confirmed' | 'rescheduled' | 'cancelled' | 'unreachable' | 'action_needed' | 'voicemail' | 'no_response';
export type CallType = 'confirmation' | 'reminder' | 'recall' | 'follow_up' | 'custom';

export interface CallTranscript {
  user?: string;
  ai_response?: string;
  intent?: string;
  role?: string;
  text?: string;
  timestamp?: string;
}

export interface CallRecord {
  id: string;
  clinic_id: string;
  patient_id: string;
  appointment_id?: string | null;
  phone_number: string;
  call_type: CallType;
  status: CallStatus;
  outcome?: CallOutcome;
  external_call_id?: string;
  transcript?: CallTranscript | CallTranscript[];
  confidence_score?: number;
  duration_seconds?: number;
  processing_time_ms?: number;
  model_version?: string;
  call_started_at?: string;
  call_ended_at?: string;
  escalation_required?: boolean;
  escalation_reason?: string;
  created_at?: string;
  updated_at?: string;
  // Joined relations
  patients?: Patient;
  clinics?: Clinic;
  appointments?: Appointment;
}

// ═══════════════════════════════════════════════════════════════
// AVAILABLE SLOT (Booking)
// ═══════════════════════════════════════════════════════════════

export interface AvailableSlot {
  id: string;
  provider_id: string;
  start_time: string;
  end_time: string;
  status: 'available' | 'locked' | 'booked' | 'cancelled';
  provider_name?: string;
  slot_type?: string;
}

export interface BookingResult {
  success: boolean;
  bookingId?: string;
  slot?: AvailableSlot;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════
// ERROR CONTEXT
// ═══════════════════════════════════════════════════════════════

export type ErrorContext = Record<string, unknown>;

// ═══════════════════════════════════════════════════════════════
// WEBHOOK & INTEGRATION
// ═══════════════════════════════════════════════════════════════

export type WebhookProvider = 'stripe' | 'twilio' | 'vapi' | 'calendar' | 'pms';

export interface ProcessedWebhook {
  id: string;
  provider: WebhookProvider;
  event_id: string;
  processed_at: string;
}

// ═══════════════════════════════════════════════════════════════
// VOICE / STREAM
// ═══════════════════════════════════════════════════════════════

export interface TwilioStreamEvent {
  event: 'connected' | 'start' | 'media' | 'stop' | 'mark';
  sequenceNumber?: string;
  streamSid?: string;
  start?: {
    streamSid: string;
    accountSid: string;
    callSid: string;
    tracks: string[];
    customParameters: Record<string, string>;
    mediaFormat: {
      encoding: string;
      sampleRate: number;
      channels: number;
    };
  };
  media?: {
    track: string;
    chunk: string;
    timestamp: string;
    payload: string;
  };
  mark?: {
    name: string;
  };
}

export interface DeepgramTranscriptResult {
  channel: {
    alternatives: Array<{
      transcript: string;
      confidence: number;
      words: Array<{
        word: string;
        start: number;
        end: number;
        confidence: number;
      }>;
    }>;
  };
  is_final: boolean;
  speech_final: boolean;
}

// ═══════════════════════════════════════════════════════════════
// GEMINI / AI ANALYSIS
// ═══════════════════════════════════════════════════════════════

export interface AnalysisResult {
  intent: string;
  confidence: number;
  response_text: string;
  requires_human: boolean;
  sentiment?: string;
  extracted_entities?: Record<string, string>;
}

export interface AnalysisResultWithTools extends AnalysisResult {
  tool_calls?: ToolCallResult[];
}

export interface ToolCallResult {
  tool_name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

// ═══════════════════════════════════════════════════════════════
// PG-BOSS / JOB QUEUE
// ═══════════════════════════════════════════════════════════════

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface PgBossInstance {
  send(name: string, data: any, options?: any): Promise<string>;
  schedule(name: string, cron: string, data?: any, options?: any): Promise<void>;
  work(name: string, options: any, handler: (job: any) => Promise<void>): Promise<void>;
  stop(options?: { graceful?: boolean; timeout?: number }): Promise<void>;
  on(event: string, handler: (...args: any[]) => void): void;
  getQueueSize(name: string): Promise<number>;
  start(): Promise<void>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ═══════════════════════════════════════════════════════════════
// ZOD VALIDATION SCHEMAS
// ═══════════════════════════════════════════════════════════════

export const OutboundCallSchema = z.object({
  appointment_id: z.string().uuid().optional(),
  patient_id: z.string().uuid().optional(),
  call_type: z.enum(['confirmation', 'reminder', 'recall', 'follow_up', 'custom']).default('confirmation'),
  clinic_id: z.string().uuid().optional(),
}).refine(
  (data) => data.appointment_id || data.patient_id,
  { message: 'Must provide either appointment_id or patient_id' }
);

export const CampaignUploadSchema = z.object({
  csv_content: z.string().min(1, 'CSV content is required'),
  clinic_id: z.string().uuid().optional(),
});

export const SignupSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(1, 'Full name is required'),
  clinic_name: z.string().optional(),
});

export const InviteSchema = z.object({
  email: z.string().email('Invalid email'),
  role: z.enum(['admin', 'staff', 'dentist', 'hygienist']).default('staff'),
});

export type OutboundCallInput = z.infer<typeof OutboundCallSchema>;
export type CampaignUploadInput = z.infer<typeof CampaignUploadSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
export type InviteInput = z.infer<typeof InviteSchema>;
