# Technical Due Diligence: AI Calling SaaS
**Date:** 2026-02-19
**Scope:** Full Stack Audit (Frontend, Backend, Voice Pipeline, Infrastructure)
**Auditor:** Principal Staff Engineer & Architect

---

## 1. High-Level Readiness Snapshot

| Component | Completeness | Verdict |
| :--- | :--- | :--- |
| **Frontend Features** | **85%** | **Production-Ready Core.** Dashboard, Calendar, Tasks are strong. `Leads` is missing. Some logic (filtering) leaks into components. No Error Boundary. |
| **Backend Features** | **70%** | **Dangerous MVP.** Campaign upload is unstable (DDoS risk). Voice pipeline is split between "Legacy" (functional) and "New" (incomplete). |
| **Data Model** | **80%** | **Solid Foundation.** Supabase schema is normalized. Row Level Security (RLS) usage needs verification. Direct DB inserts in routes bypass validation logic. |
| **Voice Pipeline** | **65%** | **Functional but Fragile.** "Legacy" handler works but is a monolith (850+ lines). "New" pipeline lacks tool execution logic. |
| **Testing** | **40%** | **Unit Only.** Good recent tests for helpers (`tool-executor`) and UI regression. **ZERO** E2E or Load tests for voice/campaigns. |
| **Observability** | **60%** | **Logs Only.** Structured logging exists. No metrics (Prometheus/Grafana) or distributed tracing (OpenTelemetry). |
| **Security** | **75%** | **Standard.** Auth/ClinicGuard are good. PII redaction mentioned. Rate limiting is missing on critical routes. |
| **DevOps** | **50%** | **Manual.** Basic scripts exist. Deployment is likely manual. No IaC (Terraform) or true CI/CD pipeline visible. |

---

## 2. Frontend State – Deep Dive

### Screens & Flows
| Screen | Status | Analysis |
| :--- | :--- | :--- |
| **Dashboard** | **Production-Ready** | Excellent wiring to real data (`useROIMetrics`, `useSystemHealth`). Visuals are premium. |
| **Tasks** | **Production-Ready** | Recent updates (Today filter, Callback) make this viable for receptionists. |
| **CallLogs** | **Stable** | Functional with filtering. Helper logic (`getPatientName`) should be extracted to hooks/utils. |
| **Campaigns** | **Prototype** | UI looks okay, but logic resides in component (`fetchCampaigns`). Missing real-time progress bars or robust error states. |
| **Leads** | **Missing** | File exists (`Leads.tsx`) but is **not routed** in `App.tsx`. Dead code. |
| **Settings** | **MVP** | Functional. |

### Architecture & Code Quality
*   **Strengths:** Uses `React Query` effectively with stale times. `ClinicContext` and `AuthContext` provide good global state.
*   **Weaknesses:**
    *   **God Components:** `Campaigns.tsx` contains data fetching and parsing logic that should be in a hook (`useCampaigns`).
    *   **No Error Boundary:** If a component crashes, the whole app likely goes white. `App.tsx` has `Toaster` but no `ErrorBoundary`.
    *   **Hardcoded Logic:** `CallLogs.tsx` has inline helpers for patient data that duplicate logic from other components.

### Frontend Completeness
*   **Core Flows:** 90% (Booking, Calls works).
*   **Clinic Owner View:** 80% (Dashboard is good, Analytics needs depth).
*   **Receptionist View:** 85% (Tasks/Calendar good, missing "Leads" management).

**Frontend TODOs to reach 95%:**
1.  Verify `Leads.tsx` and add route in `App.tsx`.
2.  Implement global `ErrorBoundary`.
3.  Refactor `Campaigns.tsx` logic into `useCampaigns` hook.
4.  Add "skeleton" loading states for `CallLogs` and `Patients` (currently likely just spinners).
5.  Standardize `getPatientName`/`Phone` helpers into `usePatient` hook.

---

## 3. Backend & System Architecture – Deep Dive

### Overall Architecture
Node/Express monolith (`services/ai-calling`) with Supabase (Postgres).
*   **Flow:** Express -> Routes -> Controllers/Services -> Supabase.
*   **Voice:** Twilio WebSocket -> `stream-handler.ts` (Legacy) *OR* `VoicePipeline.ts` (New).

### The "Split Brain" Pipeline (CRITICAL RISK)
The system has two voice pipelines:
1.  **Legacy (`stream-handler.ts`):** 850 lines. Handles STT (Deepgram), LLM (Gemini), TTS (ElevenLabs), and **Tools** (`runToolLoop`). It is messy but functional.
2.  **New (`VoicePipeline.ts`):** Clean class structure. Uses `GeminiAgent`. **BUT:** It **lacks tool execution logic**. `GeminiAgent.ts` streams text but does not execute tools (`checkAvailability`, `bookAppointment`).
**Verdict:** If `USE_NEW_PIPELINE=true` is set, the system **loses booking capability**. You are stuck with the messy Legacy pipeline for now.

### API & Services
*   **Campaigns (`routes/campaigns.ts`):** **DANGER.** The `/upload` endpoint parses CSV and immediately iterates to fire calls via `twilioClient.calls.create`.
    *   **Risk:** No rate limiting. No job queue (bypasses `pg-boss`!). Uploading 500 rows will trigger 500 simultaneous Twilio API calls, likely hitting rate limits or crashing the Node process.
    *   **Fix:** Must queue jobs into `pg-boss` (`queueJob`) and let a worker process them with concurrency limits.
*   **Webhooks (`routes/webhooks.ts`):**
    *   Handles `/twilio/voice`. Logic is rudimentary. Hardcoded checks for `callType` ('confirmation', 'reminder', 'recall').
    *   **Gap:** No "Inbound Receptionist" logic (e.g., "Thanks for calling [Clinic Name], how can I help?"). It treats all calls as outbound-initiated types.
*   **Safety Checks (`outbound.ts`):**
    *   **Excellent.** Checks `authorizedClinicId`, `automation_paused`, Billing Quota, and Duplicate Calls. This is robust.

### Data Model
*   **Tables:** `clinics`, `patients`, `appointments`, `ai_calls`, `campaigns`, `staff_tasks`.
*   **Maturity:** 80%. Schema is normalized.
*   **Issues:**
    *   `routes/campaigns.ts` uses Direct DB Inserts (`supabase.from('ai_calls').insert(...)`) instead of a service layer, bypassing any potential hooks/signals.
    *   Locking logic for slots exists (`locked_by_call_id`) but cleanup relies on `stream-handler.ts` explicitly releasing it. If the server crashes, locks might persist (zombie locks).

### Backend Completeness
*   **Core APIs:** 80% (Safety checks good).
*   **Voice Pipeline:** 65% (Legacy is technical debt, New is incomplete).
*   **Analytics/ROI:** 90% (Solid aggregation query).
*   **Billing:** 70% (Quota check exists, but payment processing/invoicing logic not seen).

---

## 4. Cross-Cutting Concerns (Industrial-Grade Checklist)

| Concern | Score (1-10) | Notes |
| :--- | :--- | :--- |
| **Testing** | **4** | Unit tests for `tool-executor` are good. **Zero** E2E/Load tests. If Twilio changes an API or latency spikes, we won't know until users complain. |
| **Observability** | **6** | `structured-logger` is decent. No metrics (Prometheus) to track active calls/Campaign progress. We are blind to real-time load. |
| **Error Handling** | **5** | Some try/catch blocks. Campaign route logs error but continues. Voice pipeline has minimal fallback (plays static message). |
| **Security** | **8** | Auth is good. Clinic isolation (RLS/Middleware) is present. PII redaction mentioned. |
| **Multi-Tenancy** | **8** | Built-in from ground up (`clinic_id` everywhere). |
| **Performance** | **3** | **Critical Risk in Campaigns.** Naive loops will kill performance. WebSocket implementation (`stream-handler`) handles single calls well but creates high memory pressure per call. |
| **DevOps** | **5** | Manual deployment scripts (`deploy.sh`). No CI/CD enforcing tests on merge. |
| **Dev Ergonomics** | **7** | `npm run dev` works. Monorepo structure is clear. |

---

## 5. Brutal "What's Missing" List (Non-Negotiable)

These items **must** be addressed before onboarding 20 clinics.

1.  **[Backend] Campaign Queueing (pg-boss):**
    *   *Impact:* Server crash / Twilio ban on first large campaign.
    *   *Fix:* Rewrite `/upload` to push jobs to `pg-boss`. Create a worker that processes jobs with `concurrency: 5`.
2.  **[Backend] Voice Pipeline Decision:**
    *   *Impact:* Cannot maintain/scale voice logic.
    *   *Fix:* Port `runToolLoop` (Booking logic) to `VoicePipeline.ts` (New) and deprecate `stream-handler.ts` (Legacy).
3.  **[Backend] Inbound Call Routing:**
    *   *Impact:* People calling back get a generic/broken experience if logic expects `callType`.
    *   *Fix:* Implement proper Inbound Call routing in `webhooks.ts` using `GEMINI_INBOUND_PROMPT`.
4.  **[Frontend] Leads Route:**
    *   *Impact:* Dead code. Users cannot manage leads.
    *   *Fix:* Wire `Leads.tsx` in `App.tsx`.
5.  **[Ops] Load Testing:**
    *   *Impact:* Unverified capacity.
    *   *Fix:* Script to simulate 50 concurrent calls to test WebSocket stability.
6.  **[Data] Zombie Lock Cleanup:**
    *   *Impact:* Appointments blocked indefinitely if server crashes during call.
    *   *Fix:* Add a cron job (`cron.ts`) to release locks older than 30 mins.
7.  **[Frontend] Error Boundary:**
    *   *Impact:* White screen of death on minor UI errors.
    *   *Fix:* Wrap `AppRoutes` in a global ErrorBoundary.
8.  **[Backend] Redis Rate Limiting:**
    *   *Impact:* Abuse/Cost spikes.
    *   *Fix:* Implement `rate-limiter-flexible` with Redis for API routes.

---

## 6. Overall Verdict & Next Steps

### Verdict
**"If we onboarded 20 clinics today, the first Campaign upload would crash the server or get our Twilio account suspended. Inbound callers would be confused. The system is a functional prototype with high-quality core booking logic but fragile infrastructure."**

### Top 10 Action List (Next 4-6 Weeks)
1.  **Campaign Queue:** Move campaign execution to `pg-boss` (Refactor `routes/campaigns.ts`). **(High Priority)**
2.  **Unify Voice Pipeline:** Add tool execution to `VoicePipeline.ts` and switch to it. Delete `stream-handler.ts`. **(High Priority)**
3.  **Inbound Handling:** Implement `handleInboundCall` in `webhooks.ts`.
4.  **Zombie Lock Cron:** Create a cleanup job for stuck `pms_slots` locks.
5.  **Fix Frontend Orphans:** Route `Leads.tsx` and refactor `Campaigns.tsx`.
6.  **Load Test:** Sim 50 concurrent calls.
7.  **Error Boundary:** Add to Frontend.
8.  **Redis Cache:** Implement for rate limiting and frequent DB lookups.
9.  **CI Pipeline:** Enforce tests on PR.
10. **Documentation:** Document the Voice Pipeline flow for new devs.
