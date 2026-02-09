# Dentacore OS — Pilot Operations Manual

**Role:** Founder / Clinical Lead
**Status:** PILOT (Day 0)
**Objective:** Validate Trust & Reliability

---

## 🛑 EMERGENCY CONTROLS

**If the AI misbehaves:**

1.  **PAUSE EVERYTHING (Global Kill Switch)**
    *   Go to **Settings > AI Settings**.
    *   Toggle "Confirmation Calls" -> **OFF**.
    *   *Effect:* The API rejects all new outbound call requests immediately (`403 CLINIC_AI_PAUSED`).

2.  **STOP INDIVIDUAL CALLS**
    *   Go to **Call Logs**.
    *   Find the "In Progress" call.
    *   (Future UI Update): We will add a "Terminate" button. For now, the pause switch prevents *new* calls.

---

## 📅 Day-in-the-Life Simulation

### 08:00 AM — Morning Rush
*   **Action:** Staff logs in. Dashboard loads.
*   **Check:** Are there "Escalations" in the Task list?
    *   *Look for:* "Patient Silent", "Ambiguous Intent".
    *   *Expectation:* Staff calls these patients manually.
    *   *Trust Signal:* The AI admitted it didn't know the answer.

### 10:00 AM — AI Batch Processing
*   **System Event:** Cron job triggers `process-followups`.
*   **Observation:** Check `Call Logs`.
    *   *Look for:* A wave of outbound calls (1-5 calls/minute).
    *   *Check:* Are they detecting voicemails correctly? (Status: `voicemail` vs `completed`).

### 01:00 PM — Lunch (Surgery)
*   **Scenario:** Doctor wants silence.
*   **Action:** Toggle "Confirmation Calls" -> **OFF**.
*   **Verification:** Run query (below) to confirm `staff_action` was logged.
*   **Result:** No phones ring during surgery.

### 04:00 PM — End of Day Review
*   **Action:** Review "Confirmed" appointments for tomorrow.
*   **Check:** Listen to 3 random recording samples (if enabled) or read transcripts.
*   **Question:** Was the AI polite? Did it interrupt?

---

## 📊 Phase 4: Pilot Success Metrics (SQL)

Run these queries in Supabase SQL Editor to track pilot health.

### 1. The "Trust" Metric
*How often does the AI succeed vs. ask for help?*

```sql
SELECT 
  count(*) as total_calls,
  count(*) filter (where outcome = 'confirmed') as confirmed,
  count(*) filter (where outcome = 'rescheduled') as rescheduled,
  count(*) filter (where escalation_required = true) as escalated,
  round((count(*) filter (where escalation_required = true)::decimal / count(*)) * 100, 1) as escalation_rate_percent
FROM ai_calls
WHERE created_at > now() - interval '7 days';
```

**Target:** < 20% Escalation Rate.

### 2. Failure Analysis
*Why is it failing?*

```sql
SELECT 
  escalation_reason,
  count(*) 
FROM ai_calls 
WHERE escalation_required = true
GROUP BY escalation_reason
ORDER BY count(*) DESC;
```

**Action:** If "Silence" is #1, increase wait time. If "Ambiguity", refine Prompt.

### 3. Doctor Control (Audit)
*Are they pausing it?*

```sql
SELECT 
  created_at, 
  event_data->>'action' as action,
  event_data->>'enabled' as new_state 
FROM analytics_events 
WHERE event_type = 'staff_action'
ORDER BY created_at DESC;
```

### 4. Revenue Impact
*Did we save money?*

```sql
-- Estimated value of confirmed appointments that were previously "unknown"
SELECT 
  cast(sum(coalesce(revenue_impact, 150.00)) as money) as revenue_secured
FROM ai_calls
WHERE outcome = 'confirmed';
```

---

## ✅ Decision Gate (Day 14)

Do NOT exit pilot until:
1.  **Escalation Rate < 15%** (Reliability)
2.  **Duplicate Calls = 0** (Safety)
3.  **Doctors stop checking every single log** (Trust)
