# Dentacore OS - AI Calling Architecture

## Overview

High-reliability AI calling system for dental clinics, leveraging Google Cloud Run, Twilio, and Gemini 3 Pro.
Designed for HIPAA compliance (auditability) and deterministic control.

## Component Diagram

```mermaid
graph TD
    Client[React Client] -->|Trigger| API[Cloud Run API]
    API -->|Create Record| Supabase[(Supabase DB)]
    API -->|Initiate Call| Twilio[Twilio Voice]

    Twilio -->|Webhook (Voice)| API
    API -->|Analyze Intent| Gemini[Gemini 3 Pro]
    Gemini -->|Action| API
    API -->|TwiML| Twilio

    Scheduler[Cloud Scheduler] -->|Cron| API
    API -->|Check Follow-ups| Supabase
```

## Cloud Infrastructure (GCP)

- **Cloud Run**: Hosts the `dentacore-ai-calling` service. Autoscaling (0 to N).
- **Cloud Scheduler**: Triggers `/cron/process-followups` every 5 minutes.
- **Secret Manager**:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_PHONE_NUMBER`
  - `GEMINI_API_KEY`

## Services

### 1. `dentacore-ai-calling` (Node.js/TypeScript)

**Responsibility**:

- Handle outbound call requests.
- Handle Inbound interactions (IVR).
- Manage call state consistency.
- Integrate Gemini for NLU (Natural Language Understanding).

**Endpoints**:

- `POST /v1/calls/outbound`: Initiate confirmation/reminder call.
- `POST /v1/webhooks/twilio/voice`: Main TwiML loop.
- `POST /v1/webhooks/twilio/status`: Call status updates (completed, failed).
- `POST /v1/cron/process-followups`: Scheduled task runner.

## Data Flow (Outbound)

1.  **Initiation**:
    - Client calls `/v1/calls/outbound` with `appointment_id`.
    - Service validates clinic hours and AI settings.
    - Creates `ai_calls` record (status: `calling`).
    - Calls Twilio API.
    - Updates `ai_calls` with `external_call_id`.

2.  **Interaction**:
    - Twilio requests TwiML from `/v1/webhooks/twilio/voice`.
    - Server greets patient based on `call_type`.
    - Server uses `<Gather>` to capture user speech.
    - Input sent to Gemini (Context: Appointment details + Transcript).
    - Gemini returns JSON: `{ intent: "confirm", response: "Great, see you then.", confidence: 0.95 }`.
    - Server executes logic based on intent (update DB) and speaks response.

3.  **Completion**:
    - Call ends.
    - `/v1/webhooks/twilio/status` triggered.
    - Final status updated in DB.
    - If `reschedule` needed, create `staff_task`.

## Gemini Integration Strategy

**Model**: `gemini-1.5-pro` (or latest '3' if available/referenced).

**Prompt Engineering**:

- **Role**: "You are a dental receptionist assistant."
- **Constraint**: "You cannot take medical advice. You verify appointments."
- **Output**: JSON only. `{ "intent": "confirm" | "reschedule" | "cancel" | "unknown", "response_text": "...", "confidence": 0-100 }`.

## Reliability & Safety

- **Rate Limiting**: Per clinic.
- **Circuit Breaker**: Stop calling if > 5 failures in 1 minute.
- **Escalation**: If `confidence < 80` or `intent=unknown` twice, bridge to clinic phone.
- **Idempotency**: `appointment_id` is the robust key.
