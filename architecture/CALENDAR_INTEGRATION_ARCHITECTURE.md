# External Calendar Integration — Architecture

## 1. Updated DB Schema

### New Table: `clinic_calendar_connections`

```
clinic_calendar_connections
├── id UUID PK
├── clinic_id UUID FK → clinics (UNIQUE per provider)
├── provider ENUM (google_calendar, microsoft_outlook, apple_calendar)
├── provider_account_email TEXT
├── provider_calendar_id TEXT DEFAULT 'primary'
│
├── access_token_encrypted BYTEA (pgcrypto AES-256)
├── refresh_token_encrypted BYTEA (pgcrypto AES-256)
├── token_expiry TIMESTAMPTZ
│
├── webhook_channel_id TEXT
├── webhook_resource_id TEXT
├── webhook_expiry TIMESTAMPTZ
│
├── sync_direction ENUM (push, pull, bidirectional)
├── sync_enabled BOOLEAN DEFAULT true
├── auto_confirm_external BOOLEAN DEFAULT false
│
├── status ENUM (active, expired, revoked, disconnected)
├── last_synced_at TIMESTAMPTZ
├── last_sync_error TEXT
├── consecutive_failures INTEGER DEFAULT 0
│
├── connected_by UUID FK → auth.users
├── connected_at TIMESTAMPTZ
└── disconnected_at TIMESTAMPTZ
```

### Extended: `appointments` table

```
+ external_event_id TEXT          -- Google Calendar event ID
+ external_provider calendar_provider  -- 'google_calendar'
+ sync_status calendar_sync_status     -- synced | pending_push | pending_pull | conflict | failed | orphaned
+ last_synced_at TIMESTAMPTZ
+ external_etag TEXT               -- Detect external modifications
```

### New Table: `calendar_sync_log` (Audit Trail)

```
calendar_sync_log
├── id UUID PK
├── clinic_id UUID FK → clinics
├── connection_id UUID FK → clinic_calendar_connections
├── appointment_id UUID FK → appointments
├── direction ENUM (push, pull, bidirectional)
├── operation TEXT (create, update, delete, conflict_resolve)
├── status TEXT (success, failed, conflict)
├── external_event_id TEXT
├── payload JSONB (PII redacted)
├── error_message TEXT
├── conflict_details JSONB
├── started_at / completed_at / duration_ms
└── created_at TIMESTAMPTZ
```

### DB Functions

| Function | Purpose |
|----------|---------|
| `encrypt_token(plain, key)` | AES-256 encrypt via pgcrypto |
| `decrypt_token(encrypted, key)` | AES-256 decrypt via pgcrypto |
| `check_appointment_conflict(clinic, start, end, exclude?)` | Returns overlapping appointments |
| `get_available_slots(clinic, date, duration)` | Returns open time slots with 15-min granularity |

---

## 2. OAuth Flow Implementation

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Clinic Admin │     │ OraDesk API  │     │ Google OAuth 2.0│
└──────┬──────┘     └──────┬───────┘     └────────┬────────┘
       │                    │                       │
       │ Click "Connect     │                       │
       │ Google Calendar"   │                       │
       │───────────────────>│                       │
       │                    │                       │
       │                    │ GET /v1/calendar/     │
       │                    │ oauth/connect         │
       │                    │──────────────────────>│
       │                    │ ← Consent URL         │
       │<───────────────────│                       │
       │                    │                       │
       │ Redirect to Google │                       │
       │───────────────────────────────────────────>│
       │                    │                       │
       │                    │     User consents     │
       │                    │<──────────────────────│
       │                    │ code + state(clinicId)│
       │                    │                       │
       │                    │ Exchange code → tokens│
       │                    │──────────────────────>│
       │                    │ ← access + refresh    │
       │                    │                       │
       │                    │ Encrypt tokens        │
       │                    │ pgcrypto AES-256      │
       │                    │ Store in              │
       │                    │ clinic_calendar_      │
       │                    │ connections            │
       │                    │                       │
       │                    │ Register webhook      │
       │                    │ channel for push      │
       │                    │ notifications         │
       │                    │──────────────────────>│
       │                    │ ← channel_id,         │
       │                    │   resource_id         │
       │                    │                       │
       │ ← Redirect to      │                       │
       │   /calendar?       │                       │
       │   connected=true   │                       │
       │<───────────────────│                       │
```

**Key Security Decisions:**
- `prompt: 'consent'` forces re-consent to always get `refresh_token`
- `state` parameter carries `clinic_id` through the OAuth flow securely
- Tokens encrypted at rest using `pgcrypto` symmetric encryption (AES-256)
- Encryption key stored in environment variable / Vault
- Auto-token refresh: `OAuth2Client.on('tokens')` handler persists new access tokens

---

## 3. Sync Service Architecture

```
                    ┌─────────────────────────────────────┐
                    │      GoogleCalendarSyncService       │
                    ├─────────────────────────────────────┤
                    │                                     │
  PUSH ─────────── │ pushAppointment(appointment)        │ ──→ Google API
                    │   • HIPAA: Redact patient names     │
                    │   • Create or Update event          │
                    │   • Store external_event_id         │
                    │   • Update sync_status = 'synced'   │
                    │   • Audit log                        │
                    │                                     │
  PULL ─────────── │ handleWebhookNotification()          │ ←── Google Push
                    │   • Lookup connection by channel     │
                    │   • Fetch recent changes             │
                    │   • For each event:                  │
                    │     - Own event? → syncOwnChanges()  │
                    │     - Known external? → update       │
                    │     - New external? → create + check │
                    │   • Conflict? → status='conflict'   │
                    │   • Audit log                        │
                    │                                     │
  DELETE ────────── │ deleteExternalEvent(appointment)     │ ──→ Google API
                    │   • Remove from Google Calendar     │
                    │   • Audit log                        │
                    │                                     │
  AVAILABILITY ──── │ getAvailableSlots(clinic, date)     │ ──→ DB function
                    │   • Combines internal + external    │
                    │   • 15-minute slot granularity       │
                    │                                     │
  CONFLICTS ─────── │ checkConflicts(clinic, start, end)  │ ──→ DB function
                    │   • Returns overlapping appointments │
                    │   • Supports exclude_id for updates  │
                    └─────────────────────────────────────┘
```

**Fault Tolerance:**
- `consecutive_failures` counter per connection
- Auto-disable sync after 5 consecutive failures
- Token auto-refresh on expiry
- Graceful degradation: if external sync fails, internal appointment still succeeds

---

## 4. Webhook Handler Logic

```
Google Calendar Push Notification
         │
         ▼
POST /v1/webhooks/google-calendar/webhook
Headers: x-goog-channel-id, x-goog-resource-id, x-goog-resource-state
         │
         ├── Respond 200 immediately (Google requires fast response)
         │
         ├── If resource_state == 'sync'
         │   └── Ignore (verification ping)
         │
         └── setImmediate (background processing)
             │
             ▼
         handleWebhookNotification(channelId, resourceId)
             │
             ├── Lookup clinic_calendar_connections by channel/resource
             │   └── Not found? → Log warning, return
             │
             ├── sync_enabled == false?
             │   └── Ignore, return
             │
             └── pullChanges(connection)
                 │
                 ├── Fetch events updated in last hour
                 │
                 └── For each event:
                     │
                     ├── Has extended_property 'oradesk_id'?
                     │   └── YES: syncOwnEventChanges()
                     │       ├── Cancelled? → Cancel internal appointment
                     │       └── Time changed? → Conflict check
                     │           ├── Conflict → status='conflict', log
                     │           └── No conflict → Apply, status='rescheduled'
                     │
                     └── NO oradesk_id:
                         ├── Already tracked (external_event_id match)?
                         │   └── YES: Update internal appointment
                         │
                         └── NO: Create new internal appointment
                             ├── Conflict check first
                             │   └── Conflict → Log, skip creation
                             └── No conflict → Insert appointment
                                 └── auto_confirm_external? → 'confirmed' : 'scheduled'
```

---

## 5. Conflict Detection Function

```sql
check_appointment_conflict(
  p_clinic_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_exclude_appointment_id UUID DEFAULT NULL  -- For update operations
)
```

**Algorithm:**
```
For all appointments in clinic where status NOT IN ('cancelled', 'missed'):
  IF appointment_start < proposed_end
  AND appointment_end > proposed_start
  AND appointment_id != excluded_id
  THEN → CONFLICT
```

**Returns:**
```
┌──────────────┬──────────────────┬──────────────────┬──────────────┬──────────────┐
│ conflict_id  │ conflict_patient │ conflict_procedure│ conflict_start│ conflict_end │
├──────────────┼──────────────────┼──────────────────┼──────────────┼──────────────┤
│ uuid-xxx     │ John Doe         │ Root Canal       │ 2026-02-22T10│ 2026-02-22T11│
└──────────────┴──────────────────┴──────────────────┴──────────────┴──────────────┘
```

**Used in:**
1. Pre-creation check (POST /check-conflicts)
2. Before pushing to Google Calendar
3. Before applying external changes from webhook
4. In `get_available_slots` DB function

---

## 6. API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/v1/calendar/oauth/connect` | ✅ JWT + Clinic | Generate Google OAuth URL |
| `GET` | `/v1/calendar/oauth/callback` | ✅ OAuth State | Exchange code → tokens |
| `POST` | `/v1/webhooks/google-calendar/webhook` | ❌ Public | Google push notification |
| `GET` | `/v1/calendar/status` | ✅ JWT + Clinic | Connection status |
| `POST` | `/v1/calendar/sync` | ✅ JWT + Clinic | Manual sync trigger |
| `GET` | `/v1/calendar/availability?date=&duration=` | ✅ JWT + Clinic | Dynamic availability |
| `POST` | `/v1/calendar/check-conflicts` | ✅ JWT + Clinic | Pre-creation conflict check |
| `POST` | `/v1/calendar/disconnect` | ✅ JWT + Clinic | Remove integration |
| `GET` | `/v1/calendar/sync-log?limit=20` | ✅ JWT + Clinic | Audit trail |

---

## 7. HIPAA Compliance

| Concern | Mitigation |
|---------|-----------|
| Patient names in external calendar | **Redacted**: Events show `[Appt] Teeth Cleaning` only |
| OAuth tokens at rest | **Encrypted**: pgcrypto AES-256 symmetric encryption |
| Token in transit | **TLS**: All Google API calls use HTTPS |
| Multi-clinic isolation | **RLS**: clinic_id enforced at DB level |
| Audit trail | **calendar_sync_log**: Every operation logged with timestamp |
| Token rotation | **Auto-refresh**: OAuth client handler persists new tokens |
| Failure isolation | **Per-connection**: Failures don't affect other clinics |

---

## 8. Environment Variables Required

```env
# Google Calendar OAuth (per deployment)
GOOGLE_CALENDAR_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_CALENDAR_REDIRECT_URI=https://api.oradesk.ai/v1/calendar/oauth/callback

# Token encryption (AES-256 key)
TOKEN_ENCRYPTION_KEY=your-32-char-encryption-key-here

# Service URL (for webhook registration)
SERVICE_URL=https://api.oradesk.ai
```

---

## 9. File Manifest

| File | Lines | Purpose |
|------|-------|---------|
| `supabase/migrations/20260222_calendar_integration.sql` | ~270 | Schema: connections, sync extensions, audit log, RLS, DB functions |
| `services/ai-calling/src/services/calendar-service.ts` | ~580 | Core sync engine: OAuth, push, pull, conflicts, availability |
| `services/ai-calling/src/routes/calendar.ts` | ~290 | Express routes: OAuth flow, webhook, status, sync, availability |
| `services/ai-calling/src/index.ts` | +3 lines | Route registration (public webhook + authenticated) |
