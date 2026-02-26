# OraDesk AI — Psychological Performance Architecture

> **Impact Score Target: 92+**
> **Methodology:** Ethical dopamine reinforcement via structured performance psychology
> **Design Grade:** Healthcare-grade trust — no gimmicks, no casino patterns

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   DASHBOARD RENDER TREE                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Dashboard (Page)                                            │
│  ├── RewardToastContainer ◄── Fixed portal (z-100)           │
│  ├── DailyRecapPanel       ◄── Layer 4: Summary              │
│  ├── AIStatusStrip          ◄── System health indicators      │
│  ├── KPIRow (4 cards)       ◄── Layer 1+2: Count-up + Glow   │
│  │   ├── AnimatedCountUp    ◄── rAF-based count-up            │
│  │   └── Glow Overlay       ◄── Conditional glow on Δ+        │
│  ├── CallVolumeChart        ◄── Recharts area chart           │
│  ├── LiveFeed               ◄── Layer 1: Micro-copy events    │
│  ├── ScheduleSnapshot       ◄── Layer 2: Progress stagger     │
│  ├── UrgentActionCenter     ◄── Layer 3: Risk relief          │
│  └── ProductivityImpact     ◄── Layer 2: ROI count-up         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 2. Dopamine Layering System

### Layer 1: Micro Reinforcement
**Trigger:** Individual data point changes
**Duration:** 150–220ms
**Components:**
- `AnimatedCountUp` — requestAnimationFrame count-up with ease-out cubic
- Value glow — `boxShadow` transition on positive delta
- Micro-copy in LiveFeed — impact-focused labels instead of generic event names

### Layer 2: Progress Reinforcement
**Trigger:** Progress toward completion
**Duration:** 220–600ms (progress fill bars)
**Components:**
- KPI schedule fill gauge with animated width
- Staggered schedule slot rendering
- Productivity Impact count-up metrics
- Badge scale-in animations for AI-booked slots

### Layer 3: Risk Relief
**Trigger:** Urgent count decrease, risk resolution
**Duration:** 280ms transform + 1.5s glow
**Components:**
- Red → Green color morph on urgent action center
- Shield toast notification
- "All Clear" state with emerald glow
- Badge count animation (scale bounce on update)

### Layer 4: Daily Performance Summary
**Trigger:** Manual toggle or end-of-day summary
**Duration:** Panel expand 280ms
**Components:**
- Collapsible recap panel with staggered metrics
- "Top Win" banner highlighting biggest achievement
- Count-up animations for all recap KPIs

---

## 3. State Transition Diagram

```
┌──────────────┐     WebSocket/         ┌───────────────────┐
│  React Query │     API Response        │  useRewardTrigger │
│  (server)    │────────────────────────▶│  Engine (hook)    │
└──────────────┘                         └─────────┬─────────┘
                                                   │
                              ┌─────────────────────┤
                              │                     │
                              ▼                     ▼
                   ┌──────────────────┐  ┌──────────────────┐
                   │ Zustand Store    │  │ Animation System │
                   │ (oraStore)       │  │ (animations.ts)  │
                   ├──────────────────┤  ├──────────────────┤
                   │ kpiSnapshot      │  │ AnimationWeight  │
                   │ animationState   │  │ requestSlot()    │
                   │ rewardTriggers   │  │ releaseSlot()    │
                   │ rewardToasts     │  │ debounce()       │
                   │ dailyRecap       │  │ prefersReduced() │
                   └────────┬─────────┘  └──────────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │ KPICard    │ │ LiveFeed   │ │ Toast      │
     │ (glow +    │ │ (micro-    │ │ Container  │
     │  count-up) │ │  copy)     │ │ (auto-     │
     │            │ │            │ │  dismiss)  │
     └────────────┘ └────────────┘ └────────────┘
```

### Trigger Flow:
```
revenue_today ↑ ──▶ debounce(300ms) ──▶ requestSlot(REVENUE) ──▶ triggerAnimation('revenueGlow')
                                                                 ──▶ pushRewardToast({icon:'revenue'})
                                                                 ──▶ pushRewardTrigger({type:'revenue_increase'})
                                                                 ──▶ setTimeout(2500ms) ──▶ releaseSlot()

schedule_fill ↑ ──▶ debounce(300ms) ──▶ triggerAnimation('scheduleFillAnimating')
                                        ──▶ [if threshold crossed] ──▶ pushRewardToast({icon:'schedule'})

urgent_count  ↓ ──▶ debounce(300ms) ──▶ requestSlot(RISK_RELIEF) ──▶ triggerAnimation('riskReliefActive')
                                                                     ──▶ pushRewardToast({icon:'shield'})

ai_confidence ↑ ──▶ debounce(300ms) ──▶ triggerAnimation('confidenceHighlight')
                                        ──▶ [if milestone crossed] ──▶ pushRewardToast({icon:'brain'})

hours_saved   ↑ ──▶ debounce(300ms) ──▶ pushRewardTrigger({type:'staff_hours_saved'})
                                        ──▶ [every 2h] ──▶ pushRewardToast({icon:'clock'})
```

---

## 4. Animation Hierarchy Rules

| Priority | Category | Weight | Can Coexist? | Max Duration |
|----------|----------|--------|--------------|--------------|
| 1 | Revenue animation | 5 | No (blocks others) | 2.5s |
| 2 | Risk resolution | 4 | No (blocks others) | 2.0s |
| 3 | Progress fill | 3 | Yes (parallel OK) | 0.6s |
| 4 | Feed item slide-in | 2 | Yes (parallel OK) | 0.2s |
| 5 | Ambient pulse | 1 | Yes (always) | ∞ (breathing) |

**Rule: Only ONE weight-4+ animation runs at a time. Lower-weight animations always proceed immediately.**

---

## 5. Timing Constants

| Token | Duration | Use Case |
|-------|----------|----------|
| `INSTANT` | 150ms | Badge appear, icon swap |
| `STANDARD` | 220ms | Value changes, list item entry |
| `EMPHASIS` | 280ms | State transforms, panel transitions |
| `COUNT_UP` | 800ms | Full count-up animation |
| `GLOW_CYCLE` | 2000ms | One full glow pulse cycle |
| `STAGGER` | 50ms | Delay between stagger children |

**Easing:** `cubic-bezier(0.33, 1, 0.68, 1)` — ease-out cubic on all transitions

---

## 6. Micro-Copy Reinforcement Map

| Generic Label | Reinforced Micro-Copy | Rationale |
|---|---|---|
| "Booking Created" | "AI just filled a gap at 2:30 PM" | Communicates **impact** (gap filled) not **action** (booking created) |
| "Payment Received" | "₹3,200 secured" | Uses **ownership language** — money is *yours now* |
| "Call Completed" | "Call handled in 3min — no staff needed" | Highlights **saved labor** — staff didn't interrupt |
| "Missed Call Recovered" | "Missed call recovered → appointment booked" | Shows **chain of value** — saved → converted |
| "Appointment Confirmed" | "Appointment confirmed — no-show risk eliminated" | Frames as **risk removal** — not just status change |
| "Booking Cancelled" | "Slot opened up — AI will auto-fill" | Converts negative into **opportunity** |
| "AI Escalation" | "Needs your attention — AI flagged for review" | **Respectful urgency** — not alarming |

---

## 7. Framer Motion Component Summary

### AnimatedCountUp
```tsx
<AnimatedCountUp
  value={revenueToday}
  prefix="$"
  duration={800}
  decimals={0}
  enableGlow={true}
  glowColor="rgba(16, 185, 129, 0.18)"
/>
```
- Uses `requestAnimationFrame` with manual ease-out cubic (not CSS)
- Tracks `prevValue` via `useRef` — only animates on delta
- Glow effect via `boxShadow` transition (GPU-accelerated)
- `aria-live="polite"` for screen readers

### RewardToastContainer
```tsx
<RewardToastContainer />  // Place once in dashboard
```
- Renders from Zustand `rewardToasts` queue
- Max 3 visible, auto-dismiss after configured duration
- Entry: opacity + y + scale (220ms)
- Exit: opacity + y + scale (150ms)
- Fixed position `top-4 right-4 z-[100]`

### DailyRecapPanel
```tsx
<DailyRecapPanel />
```
- Collapsible via `showRecapPanel` toggle in Zustand
- Staggered metric rendering (50ms between children)
- "Top Win" banner with delayed entry (100ms)
- Reads `dailyRecap` from store (populated by API or calculated)

---

## 8. Tailwind Animation Classes

```css
/* Value glow — subtle emerald on positive delta */
animate-value-glow: value-glow 2s cubic-bezier(0.33, 1, 0.68, 1)

/* Revenue glow — deeper teal for financial metrics */
animate-revenue-glow: revenue-glow 2s cubic-bezier(0.33, 1, 0.68, 1)

/* Risk relief — red→green→transparent background morph */
animate-risk-relief: risk-relief 1.5s cubic-bezier(0.33, 1, 0.68, 1)

/* Soft pulse — ambient breathing indicator */
animate-soft-pulse: soft-pulse 2s ease-in-out infinite

/* Count settle — micro scale bounce after count-up completes */
animate-count-settle: count-settle 0.22s cubic-bezier(0.33, 1, 0.68, 1)

/* Badge pop — spring-like entry for new badges */
animate-badge-pop: badge-pop 0.28s cubic-bezier(0.33, 1, 0.68, 1)
```

---

## 9. Accessibility Considerations

| Concern | Implementation |
|---|---|
| `prefers-reduced-motion` | All animations check `prefersReducedMotion()` — falls back to instant state |
| Screen readers | Count-up uses `aria-live="polite"` + `aria-atomic="true"` |
| Color contrast | All glow effects are overlays, not replacing text contrast |
| Focus management | Toast dismiss buttons are keyboard-accessible |
| WCAG 2.1 AA | No flashing >3Hz, no auto-playing distracting animations |
| Cognitive load | Animation hierarchy prevents visual overload |

---

## 10. Scalability & Performance

| Concern | Solution |
|---|---|
| **Multi-clinic** | KPI snapshot is per-clinic via `activeClinicId` in Zustand |
| **Multi-currency** | `formatCurrency()` supports USD, GBP, EUR, AUD, CAD, INR |
| **WebSocket burst** | `debounceAnimationTrigger()` groups rapid updates (300ms window) |
| **60fps budget** | Only GPU-accelerated props: `transform`, `opacity`, `boxShadow` |
| **Memory** | Live events capped at 50, reward triggers at 100, toasts at 5 |
| **Bundle size** | No new dependencies — uses existing Framer Motion + Zustand |
| **SSR safe** | `prefersReducedMotion()` checks `typeof window` |

---

## 11. File Structure

```
src/
├── lib/
│   └── animations.ts            ← Animation tokens, variants, count-up, hierarchy queue
├── stores/
│   └── oraStore.ts              ← Zustand store with reward system extensions
├── hooks/
│   └── useRewardTriggers.ts     ← Reward trigger engine (data→animation bridge)
├── components/dashboard/
│   ├── AnimatedCountUp.tsx      ← rAF count-up with glow
│   ├── RewardToasts.tsx         ← Toast notification renderer
│   └── DailyRecapPanel.tsx      ← Layer 4 daily summary
├── pages/
│   └── Dashboard.tsx            ← Main dashboard with all layers integrated
└── tailwind.config.ts           ← Extended with reward animation keyframes
```

---

## 12. Integration Checklist

- [x] Count-up animations on all KPI values
- [x] Revenue glow on `revenueToday` increase
- [x] Schedule fill progress bar animation
- [x] Risk relief (red→green) on urgency decrease
- [x] AI confidence subtle highlight
- [x] Staff hours saved periodic notification
- [x] Micro-copy reinforcement in LiveFeed
- [x] Toast notification system with auto-dismiss
- [x] Daily recap panel with "Top Win" banner
- [x] Animation hierarchy (serialized high-weight)
- [x] WebSocket debounce for rapid updates
- [x] `prefers-reduced-motion` fallback
- [x] Multi-currency support
- [x] TypeScript strict types throughout
- [x] Zero new dependencies
- [x] Build verification ✓
