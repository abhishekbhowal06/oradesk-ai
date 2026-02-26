# AI Calling Service API Reference

## Base URL
`/v1`

## Endpoints

### 1. Appointments
#### `POST /appointments/check-availability`
Check for available slots.
**Body:**
```json
{
  "clinicId": "uuid",
  "startDate": "ISO-Date",
  "endDate": "ISO-Date"
}
```

#### `POST /appointments/book`
Book a slot (Atomically locked).
**Body:**
```json
{
  "clinicId": "uuid",
  "slotId": "uuid",
  "patientId": "uuid",
  "reason": "Checkup"
}
```

### 2. Webhooks
#### `POST /webhooks/twilio/voice`
Handles incoming Twilio calls.
**Query Params:**
- `clinicId`: UUID of the clinic being called.

#### `POST /webhooks/twilio/status`
Tracks call status (ringing, answered, completed).

### 3. Management
#### `POST /cron/process-followups`
Trigger the CareLoop Engine to process due campaigns (Confirmation, Recall).
_Protected Endpoint (Internal use only)_

## Architecture Components

### CareLoop Engine
- **State Machine**: Manages patient lifecycle (Scheduled -> Confirmation -> Reminder -> Completed).
- **Campaigns**: Supports 'confirmation', 'recall', 'no-show' workflows.
- **Resiliency**: Uses Circuit Breakers and Fallback TTS.

### Caching
- **Clinic Configurations**: Cached in-memory (5m TTL).
- **Distributed Locking**: Prevents race conditions during booking.
