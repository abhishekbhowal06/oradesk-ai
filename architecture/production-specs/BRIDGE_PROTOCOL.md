# PRODUCTION BRIDGE ARCHITECTURE & OPENDENTAL PROTOCOL

## PHASE A: CLOUD-TO-CLINIC ARCHITECTURE

### 1. The Problem with Tunnels

Development tools like `localtunnel` or `ngrok` (free tier) have ephemeral URLs that change on restart.
**Production Solution:** **Cloudflare Tunnel (cloudflared)** OR **ZeroTier**.

### 2. The "Dentacore Connector" Windows Service

Instead of a Node.js script, we deploy a compiled **Go** or **.NET** binary installed as a Windows Service.

- **Service Name:** `DentacoreConnector`
- **Startup:** Automatic (Delayed Start)
- **Recovery:** Restart on failure (First/Second/Subsequent failures).
- **Update Mechanism:** Auto-update via signed binary download.

### 3. Connectivity Flow

```mermaid
[Cloud: Supabase Edge Function]
       | (HTTPS Request via Private Network)
       v
[Cloudflare Edge]
       | (Persistent Agora/Tunnel Connection)
       v
[Clinic Server: cloudflared.exe]
       | (Localhost HTTP)
       v
[Clinic Server: DentacoreConnector Service]
       | (MySQL TCP 3306)
       v
[OpenDental MySQL Database]
```

---

## PHASE B: OPENDENTAL PROTOCOL (API CONTRACT)

The Bridge Service exposes a REST API on `localhost:3000` (wrapped by the Tunnel).

### 1. GET /slots (Read Availability)

**Logic:**

1.  Query `appointment` table for existing bookings.
2.  Query `operatory` table for columns.
3.  Query `schedule` table for provider hours.
4.  Compute "gaps" (Set subtraction).

**OpenDental SQL (Recall/Hygiene):**

```sql
SELECT
    AptDateTime,
    Pattern -- (time length)
FROM appointment
WHERE
    AptStatus IN (1, 4) -- Scheduled, ASAP
    AND AptDateTime BETWEEN @Start AND @End
    AND ProvNum = @ProvNum
```

### 2. POST /appointments (Atomic Write)

**Constraint:** Must use OpenDental's internal logic if possible, or rigorous raw SQL.
**Flow:**

1.  **Read-Lock:** `START TRANSACTION; SELECT ... FOR UPDATE;`
2.  **Conflict Check:** Verify no overlap exists _inside_ the transaction.
3.  **Insert:**
    ```sql
    INSERT INTO appointment (
        PatNum, AptDateTime, AptStatus, Pattern, ProvNum, Confirmed,
        DateTStamp, Op, Note
    ) VALUES (
        @PatNum, @Time, 1, @Pattern, @ProvNum, @ConfirmedStatus,
        NOW(), @Operatory, @Note
    );
    -- Get ID: SELECT LAST_INSERT_ID();
    ```
4.  **Signal:** Insert into `signal` table (OpenDental's event bus) so other workstations refresh.
5.  **Commit:** `COMMIT;`

### 3. GET /patients/lookup (Identity Verification)

**Input:** Phone Number
**SQL:**

```sql
SELECT PatNum, LName, FName, TmStamp
FROM patient
WHERE
    (WirelessPhone = @Phone OR HmPhone = @Phone)
    AND PatStatus = 0 -- Patient
LIMIT 1;
```

### 4. POST /appointments/rollback (Compensation)

If the Cloud fails to confirm reception of the ID, we must cancel.
**SQL:**

```sql
UPDATE appointment SET AptStatus = 8 (UnschedList) WHERE AptNum = @AptNum;
```

---

## PHASE C: SAFETY GUARDRAILS IMPLEMENTATION

### 1. Do Not Call (DNC) Check

**Before Dialing:** `outreach-processor` MUST check:

1.  `dnc_list` (Global Supabase Table)
2.  `patient.prefer_contact_method != 'do_not_contact'`

### 2. Slot Revalidation

**Right before `confirm_booking`:**

1.  Re-fetch specific slot status from Bridge.
2.  Ensure `pms_slots.status` is still `locked` by `current_call_id`.

### 3. Timezone Enforcement

**Rule:** No calls before 9:00 AM or after 7:00 PM (Clinic Local Time).
**Logic:**

```typescript
const clinicTz = 'America/New_York';
const localHour = parseInt(
  new Date().toLocaleTimeString('en-US', { timeZone: clinicTz, hour12: false, hour: '2-digit' }),
);
if (localHour < 9 || localHour >= 19) throw new Error('Outside Safe Hours');
```
