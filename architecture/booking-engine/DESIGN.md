# PHASE 7: CLOSED-LOOP BOOKING ARCHITECTURE

## 1. Core Principles

- **Atomic Booking:** A slot offered to a patient is LOCKED for 5 minutes. No other patient can be offered this slot.
- **Fail-Safe:** If the call drops or AI fails, the lock expires automatically.
- **Direct PMS Write:** Booking is only confirmed if the Local Bridge returns a success ID from OpenDental.

## 2. Updated Data Schema (Supabase)

### `pms_slots` (Cache & Lock Layer)

Intermediary table to prevent hammering the local PMS.

```sql
CREATE TABLE pms_slots (
    id UUID PRIMARY KEY,
    clinic_id UUID REFERENCES clinics(id),
    provider_id VARCHAR(50), -- content from PMS
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'available', -- available, locked, booked
    locked_until TIMESTAMPTZ, -- Auto-expiration
    locked_by_call_id UUID REFERENCES ai_calls(id),
    pms_slot_id VARCHAR(100), -- External ID if exists
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(clinic_id, provider_id, start_time)
);
```

### `booking_attempts` (Audit Log)

Tracks the lifecycle of a booking request.

```sql
CREATE TABLE booking_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID REFERENCES ai_calls(id),
    slot_id UUID REFERENCES pms_slots(id),
    patient_id UUID REFERENCES patients(id),
    status VARCHAR(20) DEFAULT 'initiated', -- initiated, offer_sent, accepted, syncing, confirmed, failed
    pms_appointment_id VARCHAR(100), -- The Golden Record ID
    error_log TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 3. Local Bridge Service (Windows)

A `.NET` or `Go` service running on the clinic server.

**API Endpoints (Exposed via Tunnel/WebSocket):**

1.  `GET /slots?start=...&end=...`
    - Queries OpenDental `appointment` table for gaps.
    - Filters by `operatory` and `provider`.
    - Returns JSON array of available ISO timestamps.

2.  `POST /appointments`
    - Payload: `{ patientId, start, end, provider, note }`
    - Action:
      1. Checks availability _again_ (Double Check).
      2. Inserts into OpenDental `appointment` table.
      3. Creates `procedurelog` entries (e.g. D0120 Exam).
    - Returns: `{ success: true, appointmentId: 12345 }`

## 4. Booking State Machine (Edge Function)

1.  **INTENT_DETECTED:** AI detects "Yes, I want to book".
2.  **FETCH_SLOTS:**
    - Edge Function calls `pms_slots` (Supabase Cache).
    - If cache empty/stale -> Triggers Bridge Sync.
3.  **LOCK_SLOT:**
    - `UPDATE pms_slots SET status='locked', locked_until=NOW()+5min WHERE id=...`
    - Returns 2 locked slots to AI.
4.  **OFFER:** AI speaks: "I have Tuesday at 2pm or Thursday at 10am."
5.  **SELECTION:** Patient says "Tuesday".
6.  **SYNC_WRITE:**
    - Edge Function calls Local Bridge `POST /appointments`.
    - Waits for `appointmentId`.
7.  **FINALIZE:**
    - `UPDATE pms_slots SET status='booked', pms_slot_id=...`
    - `UPDATE booking_attempts SET status='confirmed'`
    - AI speaks: "Great, you are booked for Tuesday at 2pm."

## 5. Failure Recovery

- **Voice Failure:** If call drops during `OFFER`, lock expires in 5 mins. Slot becomes available again.
- **Bridge Offline:** If Bridge is unreachable, AI says: "I'm having trouble accessing the live schedule. I've marked this for our receptionist to call you back in 5 minutes." -> Creates `lead_queue` item (Fallback).
- **Double Booking:** If Bridge returns "Slot Taken" (rare race condition), AI says: "Apologies, that time was just taken. How about [Alternative Slot]?"

## 6. Next Steps

1.  Implement schema for `pms_slots` and `booking_attempts`.
2.  Create `pms-bridge` mock (since we don't have real OpenDental).
3.  Implement `booking-engine` Edge Function.
