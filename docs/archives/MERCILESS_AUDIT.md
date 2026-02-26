# 🚨 MERCILESS AUDIT: DENTACOR SYSTEM SCAN (CONTINUED)

**AUTHOR:** Technical Due Diligence Officer (VC Audit Team)
**DATE:** 2026-02-14
**TARGET:** `ai-calling-system`

---

## 1. EXECUTIVE SUMMARY

### **INVESTMENT VERDICT: 🚫 REJECTED UNTIL FIXED (CRITICAL SECURITY FAILURE)**

**CODE QUALITY SCORE: 40/100**

The initial audit revealed a single P0. Further investigation into `outbound.ts` and `campaigns.ts` uncovered a **systemic failure to authorize actions**. The entire API layer operates on a "high trust" model that assumes the caller is honest. Given the backend bypasses RLS (`SUPABASE_SERVICE_ROLE_KEY`), this renders the entire database vulnerable to authenticated attackers.

**However**, the `job-queue` implementation shows flashes of brilliance, proving the team _can_ execute complex systems properly.

---

## 2. CRITICAL VULNERABILITIES (MUST FIX BEFORE DEPLOYMENT)

### 🔴 **P0: THE "FREE LUNCH" EXPLOIT (Billing IDOR)**

**File:** `services/ai-calling/src/routes/billing.ts` (Lines 14, 57)
**Issue:** The `/checkout` and `/portal` endpoints accept `clinic_id` directly from the request body without verifying ownership.
**Impact:** Any user can hijack _any_ clinic's subscription or access their Stripe Customer Portal (invoices, payment methods).

### 🔴 **P0: THE "TROLL" EXPLOIT (Outbound IDOR)**

**File:** `services/ai-calling/src/routes/outbound.ts` (Line 107)
**Issue:** The `/outbound` endpoint accepts a `patient_id`, looks up their clinic via the database, and **charges that clinic's quota** to make a call. It never checks if the requester belongs to that clinic.
**Impact:** An attacker can trigger calls to _any_ patient in the database (spoofing the clinic's number), confusing patients and draining the victim clinic's credits/quota.

### 🔴 **P0: THE "SPAM CANNON" EXPLOIT (Campaigns IDOR)**

**File:** `services/ai-calling/src/routes/campaigns.ts` (Line 10)
**Issue:** The `/upload` endpoint accepts `clinic_id` and checks if phone numbers exist in that clinic's patient list.
**Impact:**

1.  **Oracle Attack:** Prove a person is a patient of a specific clinic.
2.  **Spam:** Trigger a 'recall' call campaign on behalf of a competitor.

### 🔴 **P1: THE "FAKE STREAMING" LATENCY BOTTLENECK**

**File:** `services/ai-calling/src/lib/stream-handler.ts` (Lines 405, 528)
**Issue:** The architecture waits for Gemini to complete a **full JSON object generation** (`intent`, `confidence`, `response_text`) before sending _any_ audio to TTS.
**Impact:** Introduces 500ms-1500ms latency. This is Request/Response, not Streaming.
**Fix:** Implement a streaming JSON parser or separate the "thinking" stream from the "speaking" stream.

---

## 3. CODE SMELLS & ARCHITECTURAL HIGHLIGHTS

### � **SILVER LINING: RESILIENT JOB QUEUE**

**File:** `services/ai-calling/src/lib/job-queue.ts`
**Verdict:** The use of `pg-boss` for job orchestration is excellent. It ensures crash resilience and proper locking across instances. This is production-grade.

### 🟠 **THE "PHANTOM DASHBOARD"**

**File:** `src/components/dashboard/WeeklyChart.tsx`
**Issue:** "Latency Dashboard" is missing. Only Revenue charts exist.
**Verdict:** Broken Promise.

### 🟠 **SERVICE ROLE KEY RISK**

**File:** `services/ai-calling/src/lib/supabase.ts`
**Issue:** Using `SUPABASE_SERVICE_ROLE_KEY` bypasses all Row Level Security (RLS).
**Impact:** The API layer becomes the _only_ line of defense. Since the API layer is riddled with IDORs, the database is effectively wide open to any authenticated user.

### 🟠 **TYPE SAFETY THEATER (The `any` Virus)**

**Files:** `stream-handler.ts`, `billing.ts`, `job-queue.ts`
**Issue:** Widespread `any` usage (`bossInstance: any`, `deepgramLive: any`).
**Impact:** High runtime risk.

---

## 4. THE "ELITE" POLISH (SERIES A REQUIREMENTS)

1.  **Strict TypeScript:** Enable `noImplicitAny`.
2.  **Rate Limiting:** No rate limiting middleware found on `/v1/calls`. A malicious user can drain standard tiers.
3.  **JSON Streaming:** Fix `stream-handler.ts`.
4.  **Unit Tests:** Coverage is minimal.

---

**FINAL WORD:**
The security posture is currently **"Trust Me Bro"**. In a multi-tenant healthcare SaaS, this is valid grounds for a lawsuit. Fix the 3 P0 IDORs immediately.

**[END OF AUDIT]**
