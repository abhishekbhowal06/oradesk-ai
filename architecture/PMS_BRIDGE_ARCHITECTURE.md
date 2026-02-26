# PMS Bridge Integration — Architecture Document

## Executive Summary

The OraDesk PMS Bridge enables **secure, bidirectional synchronization** between on-premise dental Practice Management Systems (starting with OpenDental) and the OraDesk cloud platform. It consists of a **lightweight Windows desktop agent** deployed at the clinic and **cloud-side services** that coordinate sync, write-back, and audit.

**Core Principle**: Internal DB = Source of Truth. PMS = Real-time Data Source.

---

## 1. Desktop Agent Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    OraDesk Bridge Agent (Windows)                     │
│                                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐              │
│  │   index.ts   │  │  sync-agent  │  │  opendental   │              │
│  │ (Entry/CLI)  │→ │  (Core Engine)│→ │  connector    │              │
│  │              │  │              │  │ (MySQL Read)  │              │
│  │ --setup      │  │ • Read Sync  │  │              │              │
│  │ --test       │  │ • Write Sync │  │ patient      │              │
│  │ --status     │  │ • Heartbeat  │  │ appointment  │              │
│  │ --start      │  │ • Offline Q  │  │ treatplan    │              │
│  └─────────────┘  │ • Audit Log  │  │ procedurelog │              │
│                    └──────────────┘  │ claimproc    │              │
│  ┌─────────────┐                     └─────┬─────────┘              │
│  │  Encrypted   │                          │                         │
│  │  Local Cache │                          │ mysql2 (Read-Only)      │
│  │              │                          │ Max 3 connections       │
│  │ sync_state   │                          │ 10s query timeout       │
│  │ offline_q    │                          ▼                         │
│  │ config       │                  ┌──────────────┐                 │
│  │ (AES-256)    │                  │ OpenDental   │                 │
│  └─────────────┘                  │ MySQL DB     │                 │
│                                    │ (Clinic LAN) │                 │
│         │                          └──────────────┘                 │
│         │ HTTPS/TLS                                                  │
│         ▼                                                            │
│  ┌──────────────┐                                                    │
│  │ Supabase SDK │ ─── Service Role Key ─── Encrypted at Rest        │
│  └──────────────┘                                                    │
└──────────────────────────────────────────────────────────────────────┘
                    │
                    │ TLS 1.3 (Encrypted Transport)
                    │ No Inbound Ports Required
                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                       OraDesk Cloud                                  │
│                                                                      │
│  ┌─────────────────┐  ┌───────────────────┐  ┌─────────────────┐  │
│  │  Bridge Routes   │  │   OraBridge.ts    │  │   Supabase DB   │  │
│  │  (Express API)   │→ │   (Cloud Service)  │→ │                 │  │
│  │                  │  │                   │  │ bridge_devices  │  │
│  │ Admin:           │  │ • Activation      │  │ pms_entity_map  │  │
│  │  POST /activate  │  │ • Heartbeat       │  │ pms_write_queue │  │
│  │  GET  /status    │  │ • Write Queue     │  │ pms_audit_log   │  │
│  │  POST /write     │  │ • Entity Mapping  │  │ pms_field_map   │  │
│  │  GET  /audit-log │  │ • Status Track    │  │                 │  │
│  │                  │  │                   │  │ patients        │  │
│  │ Agent:           │  │                   │  │ appointments    │  │
│  │  POST /register  │  │                   │  │                 │  │
│  │  POST /heartbeat │  │                   │  │                 │  │
│  │  GET  /writes    │  │                   │  │                 │  │
│  │  POST /result    │  │                   │  │                 │  │
│  └─────────────────┘  └───────────────────┘  └─────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### Agent Process Model

```
Windows Service (node.js)
    │
    ├── Read Sync Loop (setInterval: 30 sec)
    │   └── PMS MySQL → Supabase Cloud
    │
    ├── Write Queue Loop (setInterval: 5 sec)
    │   └── Supabase Cloud → PMS MySQL
    │
    ├── Heartbeat Loop (setInterval: 60 sec)
    │   └── POST /agent/heartbeat
    │
    └── Offline Queue Flush (on reconnect)
        └── Retry failed syncs from encrypted local cache
```

---

## 2. Data Flow Diagram

```
┌─────────────┐          ┌───────────────┐          ┌─────────────────┐
│  OpenDental  │          │ Bridge Agent   │          │  OraDesk Cloud   │
│  MySQL DB    │          │ (Windows)      │          │  (Supabase)      │
└──────┬──────┘          └───────┬───────┘          └────────┬────────┘
       │                          │                           │
       │  ══ READ SYNC (PMS → Cloud) ══════════════════════  │
       │                          │                           │
       │ 1. SELECT patient WHERE  │                           │
       │    DateTStamp > lastSync │                           │
       │◄─────────────────────────│                           │
       │──── rows ───────────────►│                           │
       │                          │ 2. Compute checksum       │
       │                          │    per record             │
       │                          │                           │
       │                          │ 3. Lookup pms_entity_map  │
       │                          │────────────────────────── ►│
       │                          │◄── existing or null ──────│
       │                          │                           │
       │                          │ 4a. If new: INSERT patient│
       │                          │     + INSERT entity_map   │
       │                          │──────────────────────────►│
       │                          │                           │
       │                          │ 4b. If changed (checksum  │
       │                          │     mismatch): UPDATE     │
       │                          │──────────────────────────►│
       │                          │                           │
       │                          │ 4c. If unchanged: skip    │
       │                          │                           │
       │  ══ WRITE SYNC (Cloud → PMS) ════════════════════   │
       │                          │                           │
       │                          │ 5. Poll pms_write_queue   │
       │                          │    WHERE status=pending   │
       │                          │──────────────────────────►│
       │                          │◄── pending writes ────────│
       │                          │                           │
       │                          │ 6. Claim writes           │
       │                          │    status = 'executing'   │
       │                          │──────────────────────────►│
       │                          │                           │
       │ 7. Resolve pms_id from   │                           │
       │    entity_map             │                           │
       │                          │                           │
       │ 8. Conflict check:       │                           │
       │    SELECT appointment WHERE│                          │
       │    time overlaps          │                           │
       │◄─────────────────────────│                           │
       │──── conflict or clear ──►│                           │
       │                          │                           │
       │ 9. If clear:             │                           │
       │    INSERT/UPDATE appt    │                           │
       │◄─────────────────────────│                           │
       │                          │                           │
       │                          │ 10. Report result:        │
       │                          │     status = 'completed'  │
       │                          │     + audit log           │
       │                          │──────────────────────────►│
       │                          │                           │
       │  ══ HEARTBEAT ═══════════════════════════════════   │
       │                          │                           │
       │                          │ 11. POST heartbeat every  │
       │                          │     60 sec with stats     │
       │                          │──────────────────────────►│
       │                          │◄── { pending_writes: N }──│
```

---

## 3. Sync Algorithm

### READ Sync (PMS → Cloud)

```
EVERY 30 SECONDS:

  1. PATIENTS
     ├── Query: SELECT * FROM patient WHERE DateTStamp > lastPatientSync LIMIT 500
     ├── For each patient:
     │   ├── Compute checksum(PatNum + FName + LName + Phone + DateTStamp)
     │   ├── Lookup pms_entity_map WHERE (clinic_id, 'patient', PatNum)
     │   ├── IF mapping exists AND checksum matches:
     │   │   └── SKIP (no change)
     │   ├── IF mapping exists AND checksum differs:
     │   │   ├── UPDATE patients SET first_name, last_name, phone, email
     │   │   └── UPDATE pms_entity_map SET pms_checksum, sync_version++
     │   └── IF no mapping:
     │       ├── Check existing patient by phone match
     │       ├── IF phone match: UPDATE existing patient, create mapping
     │       └── IF new: INSERT patient, INSERT pms_entity_map
     └── Save lastPatientSync = NOW()

  2. APPOINTMENTS
     ├── Query: SELECT * FROM appointment WHERE DateTStamp > lastAppointmentSync LIMIT 500
     ├── For each appointment:
     │   ├── Resolve patient_id via pms_entity_map (PatNum → oradesk_id)
     │   ├── IF patient not mapped: skip (will sync next cycle after patient syncs)
     │   ├── Compute checksum(AptNum + AptStatus + AptDateTime + DateTStamp)
     │   ├── Map AptStatus → OraDesk status (1=scheduled, 2=completed, 5=cancelled, 6=missed)
     │   ├── Convert Pattern → duration_minutes (each char = 5 min)
     │   ├── Upsert to appointments table
     │   └── Upsert to pms_entity_map
     └── Save lastAppointmentSync = NOW()

  3. TREATMENT PLANS
     ├── Query: SELECT tp.*, SUM(pl.ProcFee) FROM treatplan tp ...
     ├── For each plan:
     │   ├── Resolve patient via entity map
     │   └── Upsert to pms_entity_map (linked to patient oradesk_id)
     └── Save lastTreatmentSync = NOW()

  4. AUDIT LOG
     └── Write pms_bridge_audit_log entry with counts and duration
```

### WRITE Sync (Cloud → PMS)

```
EVERY 5 SECONDS:

  1. Poll pms_write_queue WHERE clinic_id = X AND status IN ('pending') LIMIT 5
  2. For each write command:
     ├── CLAIM: update status = 'executing'
     │
     ├── OPERATION: create_appointment
     │   ├── Resolve patient PMS ID from pms_entity_map (oradesk_id → pms_id)
     │   ├── CONFLICT CHECK: SELECT FROM appointment WHERE time overlaps AND AptStatus IN (1,3)
     │   ├── IF conflict: mark conflict_detected = true, status = 'failed'
     │   ├── IF clear: INSERT INTO appointment (PatNum, AptDateTime, Pattern, ProcDescript, AptStatus)
     │   └── CREATE pms_entity_map entry for new appointment
     │
     ├── OPERATION: update_appointment_status
     │   ├── Resolve appointment PMS ID from pms_entity_map
     │   ├── Verify appointment exists in PMS
     │   ├── Reverse-map status: scheduled=1, completed=2, cancelled=5, missed=6
     │   └── UPDATE appointment SET AptStatus = ?, DateTStamp = NOW()
     │
     ├── OPERATION: cancel_appointment
     │   ├── Resolve appointment PMS ID from pms_entity_map
     │   └── UPDATE appointment SET AptStatus = 5, DateTStamp = NOW()
     │
     └── REPORT: update pms_write_queue SET status, result, error, executed_at
         └── IF failed AND retry_count < max_retries: re-queue as 'pending'
```

---

## 4. Conflict Handling Logic

### Conflict Detection Layers

| Layer | Trigger | Check | Action |
|-------|---------|-------|--------|
| **PMS Write** | create_appointment | OpenDental SQL: `WHERE AptDateTime < end AND AptEnd > start` | Reject with conflict details |
| **Cloud Pre-check** | Calendar availability | Supabase `check_appointment_conflict()` function | Return conflicts before queuing write |
| **Concurrent Sync** | Checksum mismatch during read sync | Compare stored vs computed checksum | Overwrite cloud with PMS data (PMS wins for reads) |
| **Stale Write** | Write queue entry > 10 min old | Check if appointment still exists in PMS | Skip or cancel write |

### Conflict Resolution Strategy

```
READ CONFLICTS (PMS ← → Cloud):
  ┌─────────────────────────────────────────────────────────┐
  │  PMS is AUTHORITATIVE for reads.                        │
  │  If PMS data changed, overwrite cloud data.             │
  │  Checksum comparison = O(1) change detection.           │
  └─────────────────────────────────────────────────────────┘

WRITE CONFLICTS (Cloud → PMS):
  ┌─────────────────────────────────────────────────────────┐
  │  1. PRE-CHECK: Query PMS for overlapping appointments   │
  │  2. IF conflict exists:                                  │
  │     ├── Mark write as 'failed'                          │
  │     ├── Set conflict_detected = true                     │
  │     ├── Store conflict_details: { conflicting_apt_id,    │
  │     │     conflicting_time, conflicting_procedure }      │
  │     └── Notify cloud (status update)                     │
  │  3. Cloud surfaces conflict to staff for resolution     │
  │  4. Manual resolution options:                           │
  │     ├── Choose different time slot                       │
  │     ├── Force overbook (requires admin)                  │
  │     └── Cancel write                                     │
  └─────────────────────────────────────────────────────────┘
```

---

## 5. Security Model

### 5.1 Authentication

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION LAYERS                      │
│                                                               │
│  LAYER 1: Device Token                                       │
│    • 256-bit random token generated during setup             │
│    • SHA-256 hashed before storage in cloud DB               │
│    • Transmitted via x-device-token header                   │
│    • Validated on every agent API call                        │
│                                                               │
│  LAYER 2: Activation Code                                    │
│    • 6-digit numeric code                                    │
│    • Expires in 30 minutes                                   │
│    • One-time use (cleared after activation)                 │
│    • Generated by clinic admin via authenticated API         │
│                                                               │
│  LAYER 3: Clinic Isolation                                   │
│    • One device per clinic (UNIQUE constraint)               │
│    • clinic_id enforced on all DB queries                    │
│    • RLS policies on all bridge tables                        │
│    • Cross-clinic access = IMPOSSIBLE at DB level            │
│                                                               │
│  LAYER 4: Device Fingerprint                                 │
│    • SHA-256 of hostname + platform + arch + CPU             │
│    • Prevents token reuse on different machines              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Data Protection (HIPAA)

| Concern | Mitigation |
|---------|-----------|
| PHI in logs | **Hashed identifiers only**: PatNum → `sha256[:8]`, never raw names/phones |
| Local cache | **AES-256-CBC encrypted**: sync_state.enc, offline_queue.enc, bridge_config.enc |
| Credentials at rest | **AES-256 encrypted config file** using scrypt-derived key |
| Transport | **TLS 1.3** via Supabase SDK (HTTPS enforced) |
| PMS credentials | **Read-only MySQL user** — cannot modify schema or non-appointment data |
| Token storage | **SHA-256 hashed** in cloud DB — raw token never stored server-side |
| Audit trail | **pms_bridge_audit_log** — every read/write operation logged with timing |
| Write scope | **Strictly limited**: only create_appointment, update_status, cancel — nothing else writable |

### 5.3 Read-Only MySQL User Setup

```sql
-- Create restricted user for OraDesk Bridge
CREATE USER 'oradesk_bridge'@'localhost' IDENTIFIED BY '<secure_password>';

-- Read-only on all tables
GRANT SELECT ON opendental.patient TO 'oradesk_bridge'@'localhost';
GRANT SELECT ON opendental.appointment TO 'oradesk_bridge'@'localhost';
GRANT SELECT ON opendental.treatplan TO 'oradesk_bridge'@'localhost';
GRANT SELECT ON opendental.treatplanattach TO 'oradesk_bridge'@'localhost';
GRANT SELECT ON opendental.procedurelog TO 'oradesk_bridge'@'localhost';
GRANT SELECT ON opendental.claimproc TO 'oradesk_bridge'@'localhost';
GRANT SELECT ON opendental.paysplit TO 'oradesk_bridge'@'localhost';
GRANT SELECT ON opendental.provider TO 'oradesk_bridge'@'localhost';
GRANT SELECT ON opendental.preference TO 'oradesk_bridge'@'localhost';

-- Write access ONLY for appointment table
GRANT INSERT, UPDATE ON opendental.appointment TO 'oradesk_bridge'@'localhost';

FLUSH PRIVILEGES;
```

---

## 6. Deployment Strategy

### 6.1 Install Flow

```
┌───────────────────────────────────────────────────────────────┐
│                   BRIDGE INSTALLATION FLOW                     │
│                                                                │
│  STEP 1: Download                                             │
│  └── Clinic admin downloads oradesk-bridge-setup.exe          │
│      from Settings → Integrations → PMS Bridge                │
│                                                                │
│  STEP 2: Generate Activation Code                             │
│  └── Admin clicks "Generate Code" in OraDesk web app          │
│      → POST /v1/bridge/activate                               │
│      → Returns 6-digit code (expires in 30 min)               │
│                                                                │
│  STEP 3: Run Setup Wizard                                     │
│  └── On clinic server: oradesk-bridge --setup                 │
│      ┌────────────────────────────────────────────────┐       │
│      │ Step 1/5: Enter clinic activation code          │       │
│      │ Step 2/5: Cloud connection (auto from .env)     │       │
│      │ Step 3/5: MySQL credentials (host/port/user/pw) │       │
│      │ Step 4/5: Test connection (verify version/count)│       │
│      │ Step 5/5: Register device (encrypt & save)      │       │
│      └────────────────────────────────────────────────┘       │
│                                                                │
│  STEP 4: Start Service                                        │
│  └── npm start  (or install as Windows service)               │
│                                                                │
│  STEP 5: Verify in Dashboard                                  │
│  └── Admin sees "Bridge: Online" in OraDesk Settings          │
│      with patient count and sync status                        │
└───────────────────────────────────────────────────────────────┘
```

### 6.2 Windows Service Registration (Production)

```batch
:: Install as Windows service with node-windows
npm install -g node-windows
node install-service.js

:: Or via NSSM (Non-Sucking Service Manager)
nssm install OradeskBridge "C:\Program Files\nodejs\node.exe"
nssm set OradeskBridge AppDirectory "C:\OraDesk\Bridge"
nssm set OradeskBridge AppParameters "dist\index.js"
nssm set OradeskBridge Description "OraDesk PMS Bridge Agent"
nssm set OradeskBridge Start SERVICE_AUTO_START
nssm start OradeskBridge
```

### 6.3 Packaging Strategy

```
oradesk-bridge-v1.0.0.zip
├── dist/                     # Compiled JavaScript
│   ├── index.js              # Entry point
│   ├── sync-agent.js         # Core sync engine
│   ├── opendental-connector.js # MySQL connector
│   └── logger.js             # Winston logger
├── node_modules/             # Dependencies (bundled)
├── .env.example              # Template configuration
├── install-service.bat       # Windows service installer
├── uninstall-service.bat     # Service uninstaller
├── README.md                 # Quick start guide
└── package.json
```

---

## 7. Failure Recovery Design

### 7.1 Failure Scenarios

| Scenario | Detection | Recovery |
|----------|-----------|----------|
| **PMS MySQL down** | `connect()` fails | Retry every 30 sec. Queue to offline_queue.enc. Flush on reconnect. |
| **Cloud unreachable** | API calls fail | Continue PMS reads. Store in encrypted offline queue. Auto-flush when cloud returns. |
| **Token expired** | 401 from cloud | Agent stops sync. Admin must re-generate activation code. |
| **Agent crash** | No heartbeat for 3 min | Cloud marks device offline. Admin alerted. Agent auto-restarts (Windows service). |
| **Write conflict** | Overlapping appointment in PMS | Mark write as failed + conflict. Surface to staff in cloud UI. |
| **Consecutive failures ≥ 5** | Error counter | Auto-increase sync interval (backoff). Log critical alert. |
| **Data corruption** | Checksum mismatch | Re-sync full dataset from epoch. Rebuild entity map. |

### 7.2 Offline Queue Design

```
┌────────────────────────────────────────────────────────────┐
│  OFFLINE QUEUE (offline_queue.enc — AES-256 encrypted)     │
│                                                             │
│  Structure: Array of OfflineQueueEntry                     │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ { type: 'patient',                                   │  │
│  │   data: { pms_id, first_name, ... },                 │  │
│  │   timestamp: '2026-02-22T17:00:00Z',                 │  │
│  │   retryCount: 0 }                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Rules:                                                    │
│  • Max retries: 5 per entry                                │
│  • Entries > 5 retries are DROPPED (logged as lost)        │
│  • Queue flushed on every successful reconnect             │
│  • Queue persisted to disk between process restarts        │
│  • Encrypted with same AES-256 key as config               │
└────────────────────────────────────────────────────────────┘
```

### 7.3 Circuit Breaker

```
HEALTHY          DEGRADED          OPEN
   │                 │                │
   │ 0 failures      │ 1-4 failures   │ ≥ 5 failures
   │ Normal sync     │ Normal sync    │ Backoff mode
   │ 30 sec interval │ 30 sec         │ 5 min interval
   │                 │                │
   │ On failure ────►│ On failure ───►│
   │◄── On success ──│◄── On success─ │
   │                 │ (reset to 0)   │ (single success
   │                 │                │  resets counter)
```

---

## 8. OpenDental Database Mapping

### Table Mapping: PMS → OraDesk

| OpenDental Table | OraDesk Table | Key Column | Mapped Fields |
|-----------------|---------------|------------|---------------|
| `patient` | `patients` | PatNum | FName→first_name, LName→last_name, HmPhone→phone, Email→email, Birthdate→date_of_birth, PatStatus→status |
| `appointment` | `appointments` | AptNum | PatNum→patient_id (via map), AptDateTime→scheduled_at, Pattern→duration_minutes, ProcDescript→procedure_name, AptStatus→status, Confirmed→confirmed_status |
| `treatplan` | `pms_entity_map` | TreatPlanNum | PatNum→patient link, Heading→name, TPStatus→status, DateTP→created_at |
| `procedurelog` | Balance calculation | ProcNum | ProcFee→fee, ProcDate→procedure_date, ProcStatus→status |
| `claimproc` | Balance calculation | ClaimProcNum | InsPayAmt→insurance_paid, WriteOff→write_off |

### Status Mapping: OpenDental → OraDesk

```
AptStatus:  1 → 'scheduled'    (Scheduled)
            2 → 'completed'    (Complete)
            3 → 'scheduled'    (UnschedList → treat as scheduled)
            5 → 'cancelled'    (Broken)
            6 → 'missed'       (Planned)

PatStatus:  0 → 'active'       (Patient)
            1 → 'inactive'     (NonPatient)
            2 → 'archived'     (InactivePatient)
            3 → 'deceased'     (Deceased)

Pattern → Duration:
  "XXXXXX" = 6 chars × 5 min = 30 minutes
  "XXXXXXXXXXXX" = 12 chars × 5 min = 60 minutes
```

---

## 9. API Endpoint Reference

### Admin Endpoints (JWT + Clinic Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/bridge/activate` | Generate 6-digit activation code |
| `GET` | `/v1/bridge/status` | Get bridge device status |
| `POST` | `/v1/bridge/disconnect` | Suspend device + cancel pending writes |
| `POST` | `/v1/bridge/write` | Queue a write command |
| `GET` | `/v1/bridge/audit-log` | Get sync audit trail |
| `GET` | `/v1/bridge/entity-map` | Get PMS↔OraDesk ID mappings |
| `GET` | `/v1/bridge/write-history` | Get write queue history |

### Agent Endpoints (Device Token Auth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/bridge/agent/register` | Activate device with code + token |
| `POST` | `/v1/bridge/agent/heartbeat` | Agent heartbeat + sync stats |
| `GET` | `/v1/bridge/agent/writes` | Poll pending write commands |
| `POST` | `/v1/bridge/agent/write-result` | Report write execution result |
| `POST` | `/v1/bridge/agent/sync-report` | Report completed sync batch |

---

## 10. File Manifest

| File | Location | Lines | Purpose |
|------|----------|-------|---------|
| `20260222_pms_bridge_schema.sql` | supabase/migrations/ | ~315 | DB schema: bridge_devices, entity_map, write_queue, audit_log, field_mappings + OpenDental seeds |
| `opendental-connector.ts` | services/bridge/src/ | ~420 | MySQL connector: 5 read queries + 2 write operations + conflict check |
| `sync-agent.ts` | services/bridge/src/ | ~530 | Core sync engine: bidirectional sync, offline queue, encrypted state |
| `index.ts` | services/bridge/src/ | ~240 | CLI entry point: --setup wizard, --test, --status, --start |
| `OraBridge.ts` | services/ai-calling/src/services/ | ~310 | Cloud-side bridge manager: activation, heartbeat, write queue, entity lookups |
| `bridge.ts` | services/ai-calling/src/routes/ | ~310 | Express API routes: admin + agent endpoints |
| `package.json` | services/bridge/ | ~25 | Dependencies: mysql2, supabase, winston, dotenv |
| `index.ts` | services/ai-calling/src/ | +3 lines | Route registration |

---

## 11. Environment Variables

### Bridge Agent (.env)

```env
# Clinic Identity
CLINIC_ID=your-clinic-uuid

# Cloud Connection
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Encryption
BRIDGE_ENCRYPTION_KEY=your-32-char-passphrase

# Sync Intervals (milliseconds)
SYNC_INTERVAL_MS=30000         # Read sync: 30 sec
WRITE_POLL_MS=5000             # Write poll: 5 sec
HEARTBEAT_MS=60000             # Heartbeat: 60 sec
```

### Cloud Service (.env additions)

```env
# No new env vars required — bridge uses existing
# Supabase connection shared with other services
```
