# 🏥 DENTACORE OS — OPERATIONAL AUDIT REPORT

**Date:** 2026-02-09
**Auditor:** Operations & Investment Analyst
**Verdict:** 🛑 DO NOT DEPLOY (Requires 3 Critical Fixes)

---

## ── SECTION 1 — PRODUCT REALITY ──

**What Job Does This Actually Do?**
Currently, this is a **Fancy Robocaller with a Dashboard**.
It replaces the manual task of:

1.  Printing a list of overdue patients.
2.  Dialing them one by one.
3.  Leaving a generic voicemail if they don't answer.

**Does it generate new patients?**
NO. It recycles existing inactive patients. It is a retention tool, not an acquisition tool.

**Does it recover missed revenue?**
PARTIALLY. It identifies revenue opportunities ($250 hygiene visits), but reliance on "Lead Conversion" requires _staff_ to finalize the booking in many cases (`status: 'booked'` via manual button in `Leads.tsx`).

**Does it reduce receptionist work?**
NO. It _creates_ work.

- It generates a "Lead Queue" (Leads.tsx) that staff must monitor.
- Staff must now check _three_ inboxes: Email, Phone Voicemail, and Dentacore Lead Queue.
- **Fail:** If the AI call succeeds, does it _automatically_ write to the Practice Management Software (PMS)? No. The `pms-connect` function is a **stub** that only simulates connection. Staff must double-entry the appointment.

---

## ── SECTION 2 — FRONTEND AUDIT ──

**Receptionist Perspective:**

1.  **Usability:** 60%
    - **Good:** "Lead Queue" is clear. High priority items are flagged.
    - **Bad:** "Campaigns" creation is complex for a receptionist. Requires understanding "Target Criteria JSONB".
2.  **Dashboard-Only Features:**
    - `Analytics.tsx` is heavy on "vanity metrics" (Revenue Preserved) which are calculated based on _estimates_ ($250 fixed), not real PMS ledger data.
    - **Useless Screen:** `Calendar.tsx`? If it doesn't sync bidirectional with OpenDental/Dentrix, it's a dangerous liability. A receptionist cannot trust a calendar that might be stale.
3.  **Clicks Per Task:**
    - **Handle Lead:** 3 clicks (Open -> Read Summary -> Click "Booked"). _Acceptable._
    - **Create Campaign:** Too many clicks. Needs "One-Click Recall" templates.

---

## ── SECTION 3 — BACKEND AUDIT ──

**System Behavior Score:**

1.  **Detect Overdue:** ✅ **WORKS**
    - `detect-recall-candidates` correctly queries `patients` table based on last visit date.
    - Logic is sound (6 months cutoff).
2.  **Contact Patient:** ⚠️ **PARTIAL**
    - `outreach-processor` sends calls via Twilio.
    - **Critical Flaw:** It blindly processes 10 jobs at a time. No "Do Not Call" list check _inside_ the loop (relies on initial query). No timezone safety check in the code visible (comment says "In production we'd check").
3.  **Qualify Interest:** ⚠️ **FAKE / STUBBED**
    - The actual _Voice AI_ logic (Vapi/ElevenLabs) is not fully visible in the provided snippets. The `outreach-voice-handler` is referenced but likely relies on a webhook to an external provider.
    - If the AI says "I want to book", does it parse the date? The `lead-conversion` function expects `appointment_date` but defaults to "2 days from now" if missing. **This is not production ready.**
4.  **Hand to Staff:** ✅ **WORKS**
    - Puts data into `lead_queue`.
5.  **Track Revenue:** ⚠️ **GAMEABLE**
    - `revenue_attribution` inserts a row with `$150` or `$250` value immediately upon lead conversion.
    - Real audit: It checks `estimated_value`, not `actual_value` confirmed by a transaction.

**Backend Completion:** 40% (Missing the hard part: Real PMS write-back & Robust Conversation State).

---

## ── SECTION 4 — AGENTIC BEHAVIOR AUDIT ──

**Verdict:** **Type B - Workflow Automation**

It is **NOT** an employee. It cannot handle exceptions.

- **Decision:** "Patient picks up" -> Connect Voice AI. (Automated)
- **Decision:** "Patient says 'call me later'" -> **Human Required** (or complex retry logic not fully visible).
- **Decision:** "Patient is angry" -> **Human Required** (Hope the AI detects sentiment).

**Bottleneck:** The "Integration Bridge" (`pms-connect`) is the bottleneck. Without read/write access to the real schedule, the Agent is blind. It sends leads to a pile for humans to shovel.

---

## ── SECTION 5 — ECONOMIC VALUE TEST ──

**Scenario:** 1 Clinic, 30 Days.

- **Contacts:** 1000 patients overdue.
- **Connect Rate:** 30% (300 people).
- **Booking Rate:** 10% of connects (30 bookings).
- **Revenue:** 30 \* $200 = $6,000.

**Cost:**

- Software: $299/mo?
- Telephony: $0.10/min _ 1000 calls _ 1 min = $100.
- Staff Time: Managing 1000 leads in the "Queue". If the AI creates 50 "Leads" but only 30 book, staff chased 20 ghosts.

**Will they pay?**
**MAYBE.** $6000 retrieved for $400 cost is good ROI.
**BUT:** If staff complaints ("This thing creates mess!", "Double booked!") exceed the pain of poverty, the dentist will cancel.
**Retention Risk:** High.

---

## ── SECTION 6 — COMPETITIVE POSITION ──

- **Vs Vapi/Retell Agencies:**
  - They offer the _Bot_. You offer the _OS_.
  - **Differentiation:** Your `recall_candidates` logic + `lead_queue` UI. Agencies just give a phone number to call. You give a workflow.
  - **Moat:** Weak. Anyone can build a dashboard around Vapi. The Moat is Deep PMS Integration (OpenDental/Dentrix/EagleSoft). You currently used a stub. **You have no moat yet.**

---

## ── SECTION 7 — SURVIVAL SCORE ──

| Category            | Score | Notes                                          |
| :------------------ | :---- | :--------------------------------------------- |
| **Frontend**        | 70%   | Looks good (ShadCN), but `Calendar` is risky.  |
| **Backend**         | 40%   | Core loops work, but Integrations are fake.    |
| **Automation**      | 30%   | Stops at "Lead Creation". Doesn't "Close".     |
| **Adoption**        | 20%   | Staff will hate the "Double Entry" work.       |
| **PMF Probability** | 15%   | Without PMS Write-back, it's just a spam tool. |

### 🚨 TOP 5 MISSING CAPABILITIES (Survival Requirements)

1.  **True PMS Write-Back:** You cannot just "Create Appointment" in Supabase. You must insert it into OpenDental via API or On-Prem Bridge. Without this, you ensure double-booking.
2.  **Timezone Guardrails:** The `outreach-processor` needs strict "9am-5pm" logic enforced by the Clinic's timezone, or you will wake up patients at 3 AM and get sued.
3.  **DNC (Do Not Call) Registry:** A global `patient_consent` table checked _immediately_ before dialing.
4.  **Voicemail Detection & Drops:** If the AI talks to a voicemail machine as if it's a human, it looks stupid. Needs reliable Answering Machine Detection (AMD) + "Drop Prerecorded Msg" logic.
5.  **Smart Retry Strategy:** "Call again in 4 hours" is crude. Needs "Call tomorrow at a different time slot".

**Recommendation:**
Focus entirely on **Capability #1 (PMS Integration)** and **Capability #2 (Safety/Timezones)** before selling to a single user.
