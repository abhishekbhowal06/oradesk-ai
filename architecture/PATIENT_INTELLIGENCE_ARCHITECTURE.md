# Patient Intelligence & Follow-Up Engine — Architecture

## 1. Database Schema

### `follow_up_tasks` (First-Class Entity)

```sql
follow_up_tasks
├── id UUID PK
├── clinic_id UUID FK → clinics
├── patient_id UUID FK → patients
├── created_by UUID FK → profiles
│
├── follow_up_type ENUM (post_treatment, treatment_plan_review,
│                        recall_reactivation, payment_follow_up,
│                        lab_results, custom)
├── execution_mode ENUM (ai_automated, staff_manual)
├── priority ENUM (normal, high, urgent)
│
├── due_date DATE
├── due_time TIME
├── doctor_instructions TEXT
│
├── status ENUM (scheduled → queued → in_progress →
│                awaiting_approval → approved → completed)
│                (failed, cancelled)
│
├── ai_call_id UUID FK → ai_calls
├── ai_result_summary TEXT
├── ai_executed_at TIMESTAMPTZ
│
├── approved_by UUID FK → profiles
├── approved_at TIMESTAMPTZ
├── approval_notes TEXT
│
├── completed_at TIMESTAMPTZ
├── completed_by UUID FK → profiles
├── outcome_notes TEXT
│
├── campaign_id UUID FK → campaigns
├── outreach_job_id UUID FK → outreach_jobs
│
├── attempt_count INTEGER
├── max_attempts INTEGER
└── failure_reason TEXT
```

### `patient_intelligence` (Materialized View)

Aggregates across: patients, follow_up_tasks, appointments, revenue_attribution, ai_calls

Computed fields:
- `pending_followups`, `overdue_followups`, `next_followup_date`
- `lifetime_value`, `outstanding_balance`
- `ai_engagement_score` (successful_calls / total_calls × 100)
- `risk_level` (low/medium/high based on visit recency + missed appts + status)

---

## 2. API Endpoint Design

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/patients/intelligence` | Paginated patient list with enriched metrics |
| `GET` | `/api/patients/:id/follow-ups` | All follow-ups for a patient |
| `POST` | `/api/patients/:id/follow-ups` | Create new follow-up task |
| `PATCH` | `/api/follow-ups/:id/approve` | Doctor approves AI result |
| `PATCH` | `/api/follow-ups/:id/complete` | Mark follow-up as completed |
| `PATCH` | `/api/follow-ups/:id/cancel` | Cancel follow-up |
| `GET` | `/api/follow-ups/queue` | Pending follow-ups for outbound worker |
| `GET` | `/api/follow-ups/stats` | Dashboard-level follow-up stats |

All endpoints enforce `clinic_id` isolation via RLS.

---

## 3. React Component Hierarchy

```
Patients (Page)
├── IntelligenceStrip          ← 6 KPI cards
│   └── KPI Card × 6          ← Total, Active, Recall, Treatment, Balance, Risk
│
├── SmartFiltersSidebar        ← Left column (w-56)
│   ├── Search (debounced)
│   └── Filter buttons × 8    ← All, High LTV, Treatment Pending, etc.
│
├── PatientTable               ← Center content
│   ├── SortHeader × 8        ← Patient, Last Visit, Next Appt, LTV, Balance, Follow-Up, AI Score, Risk
│   └── PatientRow × N        ← With avatar, follow-up badge, AI bar, risk badge
│
├── PatientDetailPanel         ← Right slide-over (w-420px)
│   ├── Header (avatar + badges)
│   ├── Quick Actions (Follow-Up, Call, SMS, Schedule)
│   ├── Tabs
│   │   ├── OverviewTab       ← LTV, Balance, Contact, Next Appt, AI Score
│   │   ├── TimelineTab       ← Event timeline with connectors
│   │   ├── FollowUpsTab      ← Task cards with approve/complete buttons
│   │   └── AILogTab          ← AI call history with summaries
│   └── AddFollowUpModal      ← (triggered from Quick Actions)
│       ├── TypeSelector       ← 2×2 grid (Post-Treatment, Plan Review, Recall, Payment)
│       ├── ExecutionMode      ← AI / Staff toggle
│       ├── DatePicker         ← With quick-select chips
│       ├── InstructionsField  ← Textarea with char count
│       └── PrioritySelector   ← Normal / High / Urgent pills
│
├── AddPatientDialog           ← New patient form
└── Pagination                 ← Page controls
```

---

## 4. State Management Plan

### Server State (React Query)

| Key | Hook | Data |
|-----|------|------|
| `['patient-intelligence', clinicId, search, filter, page]` | `usePatientIntelligence` | Enriched patient list with intelligence metrics |
| `['follow-up-tasks', clinicId, patientId]` | `useFollowUpTasks` | Follow-up tasks for specific patient |

### Client State (Component-local)

| State | Location | Purpose |
|-------|----------|---------|
| `searchValue` / `debouncedSearch` | `Patients` | Debounced search input (300ms) |
| `activeFilter` | `Patients` | Smart filter selection |
| `selectedPatient` | `Patients` | Currently selected patient for detail panel |
| `sortField` / `sortDir` | `Patients` | Table sort state |
| `page` | `Patients` | Current pagination page |
| `activeTab` | `PatientDetailPanel` | Tab selection (overview/timeline/followups/ai_log) |
| `showFollowUpModal` | `PatientDetailPanel` | Follow-up modal visibility |
| Form state (type, mode, etc.) | `AddFollowUpModal` | Follow-up form inputs |

### Cache Invalidation Flow

```
createFollowUp() → invalidate ['follow-up-tasks'] + ['patient-intelligence']
approveFollowUp() → invalidate ['follow-up-tasks']
completeFollowUp() → invalidate ['follow-up-tasks']
createPatient() → invalidate ['patient-intelligence']
```

---

## 5. UI Layout Blueprint

```
┌─────────────────────────────────────────────────────────────────────┐
│ Patient Intelligence                                    [+ Add]    │
│ Revenue pipeline • Follow-up engine • Risk radar                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐         │
│ │Total │ │Active│ │Recall│ │Treat │ │Outst.│ │At-Risk   │         │
│ │2,847 │ │2,134 │ │342   │ │89    │ │$47K  │ │$12.8K    │         │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────────┘         │
│                                                                     │
│ ┌────────────┐ ┌────────────────────────────────────────────────┐   │
│ │ Filters    │ │ Patient | Visit | Appt | LTV  | Bal | FU | AI │   │
│ │────────────│ │─────────┼───────┼──────┼──────┼─────┼────┼────│   │
│ │ 🔍 Search  │ │ ◉ S.Jo  │ Dec 1 │ Jan  │$4.2K │ $0  │ ⏰ │ 89 │   │
│ │────────────│ │ ◉ M.Wi  │ Nov 3 │  —   │$3.1K │$350 │ 🔴 │ 72 │   │
│ │ ● High LTV │ │ ◉ J.Da  │ Oct 1 │ Feb  │$2.8K │ $0  │  — │ 95 │   │
│ │ ● Treat.P  │ │ ◉ L.Ch  │ Sep 2 │  —   │$1.5K │$200 │ ⏰ │ 45 │   │
│ │ ● Recall6m │ │ ◉ R.Pa  │ Aug 1 │  —   │$900  │ $0  │  — │ 30 │   │
│ │ ● No-Show  │ │                                                │   │
│ │ ● Unpaid   │ │  Page 1 of 3  [<] [>]                         │   │
│ │ ● Recent   │ └────────────────────────────────────────────────┘   │
│ │ ● Inactive │                                                      │
│ └────────────┘                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                             ┌────────────────────┐
                                             │ Sarah Johnson      │
                                             │ [Active] [Low Risk]│
                                             │────────────────────│
                                             │ [+ Follow-Up] 📞📱📅│
                                             │ Overview │ FU │ AI │
                                             │────────────────────│
                                             │ LTV: $4,200        │
                                             │ Balance: $0        │
                                             │ AI Score: ████ 89% │
                                             │ Next: Jan 15 Clean │
                                             │                    │
                                             │ ┌── Follow-Up ───┐ │
                                             │ │ Post-Treatment │ │
                                             │ │ Due: Tomorrow  │ │
                                             │ │ 🤖 AI │ High   │ │
                                             │ │ [AI Result]    │ │
                                             │ │ [✓ Approve] [✗]│ │
                                             │ └────────────────┘ │
                                             └────────────────────┘
```

---

## 6. Follow-Up Lifecycle Flow

```
Doctor clicks "Add Follow-Up"
        │
        ▼
┌─── Modal Form ───┐
│ Type: Post-Treat │
│ Mode: AI Auto    │
│ Due: Tomorrow    │
│ Notes: "Check.." │
│ Priority: High   │
└────────┬─────────┘
         │
         ▼
  follow_up_tasks INSERT
  status = 'scheduled'
         │
    ┌────┴─────┐
    │          │
    ▼          ▼
AI Mode    Staff Mode
    │          │
    ▼          │
Outbound       │
Worker picks   │
up task        │
    │          │
    ▼          ▼
status =    Staff sees
'in_progress' in task queue
    │          │
    ▼          │
AI makes       │
call           │
    │          │
    ▼          │
status =       │
'awaiting_     │
 approval'     │
    │          │
    ▼          ▼
Doctor reviews ──────────────┐
AI result summary            │
    │                        │
    ├── Approve ──▶ status = 'approved'
    │                        │
    └── Reject ───▶ Retry / Reassign
                             │
                             ▼
                    status = 'completed'
                    ✅ Success feedback
                    Cache invalidated
```

---

## 7. Psychology Rules Implementation

| Rule | Implementation |
|------|---------------|
| **Revenue dominance** | LTV column in emerald, high-LTV patients get teal avatar ring |
| **Urgency friction** | Overdue follow-ups: red badge + row tint + amber border in detail |
| **Success feedback** | Approve/Complete actions trigger toast + check animation |
| **Cognitive load** | Progressive disclosure: table → panel → modal (3 depth levels) |
| **Visual hierarchy** | KPI strip → filters → table (top-down attention priority) |
| **No-clutter** | Detail panel slides over (doesn't navigate). Quick actions visible. |
| **Risk visibility** | Risk badges colored (green/amber/red) at table + detail level |

---

## 8. Stitch MCP Design References

| Screen | Project ID | Screen ID |
|--------|-----------|-----------|
| Main CRM Tab | `2036946261697178362` | `f1adf1de30804da09724498b6d722a1f` |
| Follow-Up Modal | `2036946261697178362` | `a41fc5d0bc6f4e079e2e7b2bc66db27f` |

View at: https://stitch.google.com/projects/2036946261697178362

---

## 9. File Manifest

| File | Lines | Purpose |
|------|-------|---------|
| `supabase/migrations/20260222_patient_intelligence_followups.sql` | ~195 | Schema: follow_up_tasks table + patient_intelligence view |
| `src/hooks/usePatientIntelligence.ts` | ~350 | Dual hook: patient intelligence + follow-up tasks |
| `src/components/patients/AddFollowUpModal.tsx` | ~250 | 5-section follow-up scheduling modal |
| `src/components/patients/PatientDetailPanel.tsx` | ~430 | 4-tab slide panel with approval workflow |
| `src/pages/Patients.tsx` | ~500 | Main page: KPI strip, filters, table, panel |
