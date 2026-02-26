# DENTACORE OS - OPERATIONS RELIABILITY REPORT

## Executive Summary

This report documents the Production Operations Engineering implementation for Dentacore OS. The system now has comprehensive mechanisms to survive real-world usage without engineer intervention.

---

## PHASE 1: SILENT FAILURE DETECTION

### Failure Types Detected

| Failure                          | Detection Method     | Severity |
| -------------------------------- | -------------------- | -------- |
| Call stuck in queue >15min       | Time threshold check | High     |
| Escalation unhandled >4hrs       | Staleness check      | Critical |
| Consent revoked, still scheduled | Cross-table join     | High     |
| Automation paused, calls running | State mismatch check | High     |
| Staff tasks stale >24hrs         | Age check            | Medium   |

### Detection Output

Every failure produces:

- ✅ Structured log entry (`logger.warn`)
- ✅ Alert in staff dashboard
- ✅ Recovery suggestion
- ✅ Human action description

### Implementation

```
services/ai-calling/src/lib/operations-reliability.ts
├── detectStuckCalls()
├── detectUnhandledEscalations()
├── detectConsentConflicts()
├── detectPausedAutomationLeaks()
└── runFailureDetection()
```

---

## PHASE 2: OBSERVABILITY LAYER

### Clinic-Understandable Signals

| Technical Metric              | Staff Message                       |
| ----------------------------- | ----------------------------------- |
| Call success rate <50%        | "Most patients not answering calls" |
| Unreachable rate >30%         | "30% of patients didn't answer"     |
| Escalation backlog >0         | "X patients need staff attention"   |
| Task backlog >5               | "Front desk may be overloaded"      |
| Automation effectiveness <40% | "AI confirmation rate is low"       |

### Health Endpoint

```
GET /v1/ops/health/:clinicId
```

Returns:

```json
{
  "status": "needs_attention",
  "summary": "Some items need your attention",
  "signals": [
    {
      "name": "3 patients need staff attention",
      "status": "warning",
      "action": "Review pending escalations"
    }
  ]
}
```

---

## PHASE 3: SELF RECOVERY LOGIC

### Automatic Recovery Rules

| Failure                         | Auto-Recovery Action            |
| ------------------------------- | ------------------------------- |
| Stuck call                      | Mark failed → Create staff task |
| Paused clinic with active calls | Cancel calls immediately        |
| Unhandled escalation            | Create URGENT staff task        |
| Circuit breaker open            | Reject new calls gracefully     |

### Recovery Priority

1. **Safe inactivity over incorrect action**
2. Defer to human when uncertain
3. Create staff task instead of guessing
4. Log every recovery attempt

### Background Monitor

```typescript
// Runs every 5 minutes
runFailureDetection() → runAutoRecovery()
```

---

## PHASE 4: HUMAN INTERVENTION DESIGN

### Staff Dashboard Alerts

**What Staff Sees:**

```
┌─────────────────────────────────────────────┐
│ ⚠️ 3 patients need attention           View │
└─────────────────────────────────────────────┘

Expanded:
┌─────────────────────────────────────────────┐
│ 🔴 URGENT: Patient upset on call           │
│    John Smith • +1 555-1234                 │
│    2 hours ago                              │
│    [ Call Patient ] [ Mark Done ]           │
├─────────────────────────────────────────────┤
│ 🟡 Patient needs callback                   │
│    Jane Doe • +1 555-5678                   │
│    AI could not complete scheduling         │
│    [ Call Patient ] [ Mark Done ]           │
└─────────────────────────────────────────────┘
```

**What Staff Clicks:**

- `Call Patient` → Opens dialer
- `Mark Done` → Logs resolution, removes alert

**What Staff Decides:**

- Did patient answer?
- Was issue resolved?
- Any notes needed?

### No Technical Language

- No "escalation_required"
- No "circuit breaker"
- No "database timeout"

Only: "Patient needs callback", "AI couldn't connect", "Front desk overloaded"

---

## PHASE 5: INCIDENT SIMULATION

### Scenario: Twilio Down

**System Response:**

1. Circuit breaker opens after 3 failures
2. New calls rejected with "service unavailable"
3. Dashboard shows purple banner: "AI calling temporarily unavailable"
4. Queued calls marked as "deferred"
5. Health check attempts recovery every 60s

**Staff Recovery:**

1. See purple banner: "AI Calls Paused - Use Manual Calling"
2. Click "View Queue" → See pending patients
3. Call patients manually
4. When banner turns green, AI resumes

---

### Scenario: Clinic Closes Early

**System Response:**

1. Calls continue until manually paused
2. Patients say "office is closed"
3. AI escalates these as "patient concern"
4. Staff sees spike in escalations

**Staff Recovery:**

1. Click "Pause AI Calls" immediately
2. Update business hours in Settings
3. Resume when hours correct
4. Review bad-timing escalations

---

### Scenario: Receptionist Ignores Dashboard

**System Response:**

1. Escalation backlog grows
2. 4 hours: Email alert to clinic admin
3. 8 hours: SMS alert to clinic owner
4. Dashboard shows red badge
5. 24 hours: Automation auto-pauses

**Staff Recovery:**

1. Check email/SMS alerts
2. Open dashboard, clear backlog
3. Discuss monitoring with team

---

### Scenario: Patient Angry on Call

**System Response:**

1. Emergency phrases detected
2. AI: "I understand this is frustrating"
3. AI escalates: "A staff member will call you right away"
4. RED ALERT at top of dashboard

**Staff Recovery:**

1. See red alert: "Urgent: Upset patient"
2. Call within 15 minutes
3. Listen, apologize, resolve
4. Mark as handled with notes

---

## FILES CREATED

```
services/ai-calling/src/
├── lib/
│   └── operations-reliability.ts    # Core detection/recovery
├── routes/
│   └── operations.ts                # Health & alert endpoints

src/components/dashboard/
├── StaffAlertBanner.tsx             # Staff alert banner
├── ClinicHealthCard.tsx             # Health status card

supabase/migrations/
└── 20260205120000_operations_reliability.sql
```

---

## OPERATIONAL ENDPOINTS

| Endpoint                          | Purpose                         |
| --------------------------------- | ------------------------------- |
| `GET /v1/ops/health/:clinicId`    | Clinic health in staff language |
| `GET /v1/ops/alerts/:clinicId`    | Pending staff actions           |
| `POST /v1/ops/alerts/:id/handle`  | Mark alert resolved             |
| `POST /v1/ops/detect-and-recover` | Run failure scan (cron)         |
| `GET /v1/ops/system-status`       | Overall system health           |
| `GET /v1/ops/playbook/:scenario`  | Incident response guide         |

---

## HIGHEST LEVERAGE IMPROVEMENTS

1. **Background monitor every 5 min** - Catches failures before staff notices
2. **Staff alert banner** - Forces attention to pending items
3. **Auto-recovery for stuck calls** - Prevents infinite queues
4. **Escalation timeout** - Ensures no patient left behind
5. **Incident playbooks** - Staff knows what to do

---

## NOT IMPLEMENTED (NOT FEATURES)

- ❌ New call flows
- ❌ New AI capabilities
- ❌ New integrations
- ❌ Dashboard redesign

✅ Only: Detection, alerting, recovery, human intervention
