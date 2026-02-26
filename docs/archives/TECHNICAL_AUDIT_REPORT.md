# Master Technical Audit Report: AI Calling SaaS
**Date:** 2026-02-19
**Auditor:** Principal Staff Engineer & Architect (AI/Voice Specialist)
**Target:** Production Readiness (20+ Clinics Pilot)

---

## 1. High-Level Readiness Snapshot

| Component | Maturity Score | Executive Summary |
| :--- | :---: | :--- |
| **Frontend Feature Completeness** | **65%** | **PROTOTYPE**. Core UI components (Shadcn/Lucide) are solid, and flows exist for Dashboard, Calendar, and Settings. However, error states, loading skeletons, and complex validations are likely missing. Mobile responsiveness is unverified. |
| **Backend Feature Completeness** | **50%** | **FRAGILE**. The core voice logic lives in a single "God Class" (`stream-handler.ts`, 860+ lines). While functional, it bridges Twilio, Deepgram, LLM, and DB logic tightly, making it a nightmare to debug or scale. |
| **Data Model & Migrations** | **70%** | **ACCEPTABLE BUT RISKY**. Core relational schema exists (`clinics`, `appointments`), but excessive reliance on `JSONB` columns (`ai_settings`, `working_hours`) allows schema drift and complicates reporting. RLS is enabled, which is a major plus. |
| **Voice Pipeline Readiness** | **40%** | **LEGACY MODE**. The system explicitly runs in "Legacy" mode (see `index.ts`), relying on an older websocket handler. Newer Vapi/VoicePipeline V2 code appears to be stubbed or inactive. Latency optimization and interruption handling are likely basic. |
| **Testing & Verification** | **0%** | **CRITICAL FAILURE**. No meaningful unit, integration, or E2E test suite found (`*.test.ts` search returned 0 results). Production deployment without tests is reckless. |
| **Observability/Monitoring** | **30%** | **PARTIAL**. `operations-reliability.ts` contains excellent logic for failure detection (stuck calls, conflict detection), but logs indicate it may not be fully active or integrated with a real alerting system (PagerDuty/Slack). |
| **Security & Multi-tenancy** | **60%** | **MIXED**. IDOR checks in `billing.ts` are a good sign. RLS protects data. However, hardcoded API keys in env vars (vs Secret Manager) and lack of sophisticated role-based access control (RBAC) beyond "admin/receptionist" is a gap. |
| **DevOps/CI/CD** | **20%** | **MISSING**. No Dockerfiles, Helm charts, or GitHub Actions evident in the reviewed scope. Manual deployment seems to be the current standard. |

---

## 2. Frontend State – Deep Dive

### 1) Screens & Flows
*   **Dashboard (`Dashboard.tsx`):** `Prototype`. Visualizes data, but likely mocks or simple fetches. Needs real-time websocket updates for "Live Calls".
*   **Calendar (`Calendar.tsx`):** `Incomplete`. Scheduling is complex. Handling timezones (`America/New_York` hardcoded in DB default) properly across frontend/backend is a common failure point.
*   **Patients (`Patients.tsx`):** `Prototype`. CRUD seems present. Needs search/filter/pagination for 1000+ patient lists.
*   **Settings (`Settings.tsx`):** `Production-Ready`. Good structure for handling complex config (Voice, AI settings).
*   **Login/Onboarding (`Login.tsx`, `Onboarding.tsx`):** `Solid`. Auth flow using Supabase is generally reliable.

### 2) Architecture & Code Quality
*   **Component Structure:** Clean separation (`src/components/ui`, `src/pages`, `src/lib`). Usage of `lucide-react` and `shadcn` provides a consistent "Industrial" aesthetic.
*   **State Management:** Heavily reliant on React Context (`ClinicContext`). This works for <50 clinics but will cause render performance issues as app grows. No Global State library (Zustand/Redux) seen, which is fine for now but limits complex flows.
*   **API Pattern:** `src/lib/api.ts` is a verified decent wrapper around `fetch` with auth header injection. Good foundation.

### 3) Frontend % Estimates
*   **Core Flows:** 70% (Happy paths work).
*   **Clinic Owner View:** 50% (ROI/Analytics likely mock data).
*   **Receptionist View:** 40% (Missing "Live Call Control" or "Barge-in" UI).

**Top 5 Frontend TODOs:**
1.  **Error Boundaries:** Wrap every major page in an Error Boundary to prevent white-screen crashes.
2.  **Loading States:** Replace spinners with Skeleton loaders for perceived performance.
3.  **Form Validation:** Implement `zod` schema validation for all inputs (especially Campaign creation).
4.  **Mobile View:** Verify responsive layout for doctors processing calls on the go.
5.  **Real-time Context:** Connect `ClinicContext` to Supabase Realtime for live call updates.

---

## 3. Backend & System Architecture – Deep Dive

### 1) Overall Architecture
The backend is a **Monolith** masquerading as microservices.
*   **Core Service:** `services/ai-calling` handles *everything*: HTTP API, Websockets (Twilio), Cron jobs, and Billing.
*   **"God Class" Alert:** `StreamingVoiceHandler` (860+ lines) in `src/lib/stream-handler.ts`. It manages:
    *   Websocket connection stuff.
    *   Deepgram audio buffering.
    *   ElevenLabs TTS streaming.
    *   Gemini LLM context management.
    *   **AND** Database writes (`updateCallOutcome`).
    *   **AND** Business logic (`loadCallContext`).
    *   *Risk:* Any change to business logic risks breaking the voice pipeline. Refactor urgent.

### 2) APIs & Services
*   **Billing (`routes/billing.ts`):** `Solid`. Real Stripe integration found. Logic to check `usage` vs `limit` exists.
*   **Operations (`lib/operations-reliability.ts`):** `Excellent Logic / Unclear Execution`. The code for `detectStuckCalls` is sophisticated, but `index.ts` suggests it calls `runOpsMonitor` in a `setInterval`. This is fragile; if the server restarts, state is lost. Should be a reliable background worker.
*   **Webhooks:** `stripe-webhooks.ts` and `vapi-webhooks.ts` exist. Good standard practice.

### 3) Data Model & DB Layer
*   **Schema:** Table structure (`clinics`, `patients`, `appointments`) is standard.
*   **JSONB Abuse:** `clinics.ai_settings` and `clinics.working_hours` are JSONB.
    *   *Risk:* You cannot easily query "Find all clinics open on Sundays" without expensive JSON operators.
    *   *Risk 2:* No strict schema validation on write. A bug could wipe out `ai_settings`.
*   **Migrations:** Present (`20260214...sql`). Using raw SQL migrations is good for control but requires discipline.

### 4) Integrations
*   **Twilio:** Tightly coupled in `StreamingVoiceHandler`. switching to Vapi/Retell would require rewriting the core.
*   **Deepgram/ElevenLabs:** Hardcoded in `stream-handler`. Logic is mixed with transport.
*   **Supabase:** Tightly coupled via `supabase-js` client. Hard to swap auth/db providers later (low risk now).

### 5) Backend % Estimates
*   **Core APIs:** 60% standard CRUD.
*   **Voice Pipeline:** 40% (Legacy/Brittle).
*   **Analytics/ROI:** 20% (Likely basic counts).
*   **Billing:** 80% (Stripe is hard to mess up if using Checkout).

---

## 4. Cross-cutting Concerns (Industrial-Grade Checklist)

| Concern | Score (1-10) | Notes |
| :--- | :---: | :--- |
| **Testing** | **1/10** | **FATAL**. No test runner configured. No unit tests for complex regex/parsing logic in voice handler. |
| **Observability** | **3/10** | `logger` exists, but likely just console output. No OpenTelemetry, no structured logs shipped to Datadog/axiom. `operations-reliability.ts` is a hidden gem that needs UI visibility. |
| **Error Handling** | **4/10** | Global error handler exists in express. `stream-handler` has try/catch blocks, but "swallowing errors" to keep the call alive is a risk (zombie calls). |
| **Security** | **6/10** | RLS is the saving grace. Explicit IDOR checks in API are good. Secrets management needs upgrade from `.env` files. |
| **Multi-tenancy** | **7/10** | `clinic_id` is pervasive in schema and API checks. Good isolation. |
| **Performance** | **4/10** | Node.js single thread for Websockets + CRUD is risky. CPU intensive tasks (audio processing) should be offloaded to a separate service or Worker threads. |
| **DevOps** | **2/10** | No Dockerfile found. "Works on my machine" is the current deployment strategy. |

---

## 5. Brutal "What's Missing" List (Non-negotiable)

1.  **[Backend] UNIT TESTS:** You cannot touch `stream-handler.ts` without breaking it. You need tests for it.
2.  **[Infra] Rate Limiting:** No rate limiting middleware (`express-rate-limit`) found. One malicious script can drain your Deepgram credits in minutes.
3.  **[Voice] Barge-in/Interruption:** Current implementation in `stream-handler` looks manual (`sendClearCommand`). Needs robust logic to stop TTS *instantly* when user speaks.
4.  **[Data] TypeScript-to-SQL Sync:** `ai_settings` type in TS might diverge from JSON structure in DB. Use Zod to validate JSONB on read/write.
5.  **[Ops] Dead Letter Queue:** If a webhook fails (Stripe/Vapi), it's lost. Need a retry mechanism (`pg-boss` or similar).
6.  **[Frontend] Fallback UI:** If Supabase is slow/down, the app likely white-screens.
7.  **[Security] API Key Rotation:** If `ELEVENLABS_API_KEY` leaks, you have no way to rotate it without redeploying.
8.  **[Product] Onboarding Validation:** Can a clinic with incomplete `working_hours` go live? Probably yes, causing bugs.
9.  **[Voice] Latency Tracing:** You don't know *where* the delay is (STT, LLM, or TTS). Add timestamps to logs.
10. **[Billing] Usage Hard-stop:** If a user hits 100% of their limit mid-call, does it cut off? Or allow overage? (Currently looks like it checks *before* call).

---

## 6. Overall Verdict & Next Steps

### Verdict
**"Do Not Launch."**
If you onboarded 20 clinics today, **the system would collapse under specialized edge cases** (e.g., simultaneous calls, timezone bugs, network flakiness). Debugging would be impossible due to lack of logs/tracing. You would burn your seed capital on manual support/refunds.

### Prioritized Action Plan (4-6 Weeks)
1.  **Write Tests for `stream-handler.ts`:** Mock Twilio/Deepgram and ensure state machine is robust. (1 week)
2.  **Decouple Voice Logic:** Break `StreamingVoiceHandler` into `TranscriptionService`, `LLMService`, `TTSService`. (1 week)
3.  **Implement Logging/Tracing:** Add request IDs to every log. Ship logs to a searchable backend. (3 days)
4.  **Harden Queueing:** Ensure `pg-boss` handles all async tasks (emails, summaries, webhooks). (3 days)
5.  **Fix JSONB Types:** Create Zod schemas for `ai_settings` and enforce them at the API boundary. (2 days)
6.  **Load Test:** Simulate 50 concurrent websocket connections. Node.js might choke; you might need to cluster. (1 week)
7.  **Rate Limiting & Security Headers:** Add `helmet`, `cors` strict options, and rate limits. (1 day)
8.  **CI/CD Pipeline:** Automate testing and deployment to a staging env. (2 days)
