/**
 * ORADESK GLOBAL UI STORE (Zustand v3)
 *
 * Single source of truth for cross-cutting UI state.
 * Server state (API data) lives in React Query — NOT here.
 * This store owns only ephemeral UI concerns.
 *
 * Reward Trigger System:
 *   - Tracks previous values to detect positive changes
 *   - Fires animation signals on: revenue↑, fill↑, urgency↓, confidence↑
 *   - Debounces rapid WebSocket updates to prevent animation spam
 */

import create from 'zustand';

// ─── Types ──────────────────────────────────────────────────

export type CurrencyCode = 'USD' | 'GBP' | 'EUR' | 'AUD' | 'CAD' | 'INR';
export type DateRange = '1d' | '7d' | '30d' | '90d' | 'ytd';
export type AILiveStatus = 'online' | 'degraded' | 'offline';
export type LiveEventType =
    | 'booking_created'
    | 'booking_cancelled'
    | 'payment_received'
    | 'ai_escalation'
    | 'pms_sync_failure'
    | 'call_completed'
    | 'call_started'
    | 'missed_call_recovered'
    | 'appointment_confirmed'
    | 'emergency_hard_stop'
    | 'revenue_saved'
    | 'escalation_created';

export interface LiveEvent {
    id: string;
    type: LiveEventType;
    timestamp: string;
    clinicId: string;
    patientName?: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    metadata?: Record<string, unknown>;
}

// ─── Reward Trigger Types ───────────────────────────────────

export type RewardTriggerType =
    | 'revenue_increase'
    | 'slot_filled'
    | 'risk_resolved'
    | 'ai_confidence_up'
    | 'staff_hours_saved';

export interface RewardTrigger {
    type: RewardTriggerType;
    timestamp: number;
    previousValue: number;
    newValue: number;
    delta: number;
    /** Human-readable micro-copy for the trigger */
    message: string;
}

// ─── Animation State ────────────────────────────────────────

export interface AnimationState {
    /** Revenue glow active */
    revenueGlow: boolean;
    /** Schedule progress animating */
    scheduleFillAnimating: boolean;
    /** Risk badge transitioning red→green */
    riskReliefActive: boolean;
    /** AI confidence highlight active */
    confidenceHighlight: boolean;
    /** KPI that just updated (for count-up) */
    activeCountUp: string | null;
}

// ─── Toast Notification ─────────────────────────────────────

export interface RewardToast {
    id: string;
    type: RewardTriggerType;
    message: string;
    subtext?: string;
    icon: 'revenue' | 'schedule' | 'shield' | 'brain' | 'clock';
    timestamp: number;
    autoDismissMs: number;
}

// ─── Daily Recap ────────────────────────────────────────────

export interface DailyRecap {
    revenueToday: number;
    revenueDelta: number;
    slotsFilled: number;
    slotsTotal: number;
    risksResolved: number;
    risksRemaining: number;
    aiCallsHandled: number;
    staffHoursSaved: number;
    topAchievement: string;
    generatedAt: string;
}

// ─── Store Shape ────────────────────────────────────────────

interface OraStore {
    // Identity
    activeClinicId: string | null;
    setActiveClinicId: (id: string) => void;

    // Display
    selectedDateRange: DateRange;
    setDateRange: (range: DateRange) => void;
    currencyMode: CurrencyCode;
    setCurrencyMode: (c: CurrencyCode) => void;

    // Real-time
    aiLiveStatus: AILiveStatus;
    setAILiveStatus: (s: AILiveStatus) => void;
    activeCallsCount: number;
    setActiveCallsCount: (n: number) => void;
    lastPmsSyncTime: string | null;
    setLastPmsSyncTime: (t: string) => void;

    // Notifications
    notificationCount: number;
    incrementNotifications: () => void;
    clearNotifications: () => void;

    // Live Feed
    liveEvents: LiveEvent[];
    pushLiveEvent: (event: LiveEvent) => void;
    clearLiveEvents: () => void;

    // Preferences
    darkMode: boolean;
    toggleDarkMode: () => void;
    compactMode: boolean;
    toggleCompactMode: () => void;

    // ── REWARD SYSTEM ───────────────────────────────────────

    // Tracked KPI values (for delta detection)
    kpiSnapshot: {
        revenueToday: number;
        scheduleFillPct: number;
        urgentCount: number;
        aiConfidence: number;
        staffHoursSaved: number;
    };
    updateKpiSnapshot: (partial: Partial<OraStore['kpiSnapshot']>) => void;

    // Animation state
    animationState: AnimationState;
    triggerAnimation: (key: keyof AnimationState, durationMs?: number) => void;

    // Reward triggers (history for recap)
    rewardTriggers: RewardTrigger[];
    pushRewardTrigger: (trigger: RewardTrigger) => void;

    // Toast queue
    rewardToasts: RewardToast[];
    pushRewardToast: (toast: RewardToast) => void;
    dismissRewardToast: (id: string) => void;

    // Daily Recap
    dailyRecap: DailyRecap | null;
    setDailyRecap: (recap: DailyRecap) => void;
    showRecapPanel: boolean;
    toggleRecapPanel: () => void;
}

// ─── Store Implementation ───────────────────────────────────

const MAX_LIVE_EVENTS = 50;
const MAX_REWARD_TRIGGERS = 100;
const MAX_TOASTS = 5;

export const useOraStore = create<OraStore>((set, get) => ({
    // Identity
    activeClinicId: null,
    setActiveClinicId: (id) => set({ activeClinicId: id }),

    // Display
    selectedDateRange: '1d',
    setDateRange: (range) => set({ selectedDateRange: range }),
    currencyMode: 'USD',
    setCurrencyMode: (c) => set({ currencyMode: c }),

    // Real-time
    aiLiveStatus: 'online',
    setAILiveStatus: (s) => set({ aiLiveStatus: s }),
    activeCallsCount: 0,
    setActiveCallsCount: (n) => set({ activeCallsCount: n }),
    lastPmsSyncTime: null,
    setLastPmsSyncTime: (t) => set({ lastPmsSyncTime: t }),

    // Notifications
    notificationCount: 0,
    incrementNotifications: () => set((s) => ({ notificationCount: s.notificationCount + 1 })),
    clearNotifications: () => set({ notificationCount: 0 }),

    // Live Feed — LIFO capped at MAX_LIVE_EVENTS
    liveEvents: [],
    pushLiveEvent: (event) =>
        set((s) => ({
            liveEvents: [event, ...s.liveEvents].slice(0, MAX_LIVE_EVENTS),
        })),
    clearLiveEvents: () => set({ liveEvents: [] }),

    // Preferences
    darkMode: false,
    toggleDarkMode: () => set((s) => ({ darkMode: !s.darkMode })),
    compactMode: false,
    toggleCompactMode: () => set((s) => ({ compactMode: !s.compactMode })),

    // ── REWARD SYSTEM ─────────────────────────────────────────

    kpiSnapshot: {
        revenueToday: 0,
        scheduleFillPct: 0,
        urgentCount: 0,
        aiConfidence: 0,
        staffHoursSaved: 0,
    },
    updateKpiSnapshot: (partial) =>
        set((s) => ({
            kpiSnapshot: { ...s.kpiSnapshot, ...partial },
        })),

    animationState: {
        revenueGlow: false,
        scheduleFillAnimating: false,
        riskReliefActive: false,
        confidenceHighlight: false,
        activeCountUp: null,
    },
    triggerAnimation: (key, durationMs = 2000) => {
        set((s) => ({
            animationState: { ...s.animationState, [key]: true },
        }));
        setTimeout(() => {
            set((s) => ({
                animationState: { ...s.animationState, [key]: false },
            }));
        }, durationMs);
    },

    rewardTriggers: [],
    pushRewardTrigger: (trigger) =>
        set((s) => ({
            rewardTriggers: [trigger, ...s.rewardTriggers].slice(0, MAX_REWARD_TRIGGERS),
        })),

    rewardToasts: [],
    pushRewardToast: (toast) =>
        set((s) => ({
            rewardToasts: [toast, ...s.rewardToasts].slice(0, MAX_TOASTS),
        })),
    dismissRewardToast: (id) =>
        set((s) => ({
            rewardToasts: s.rewardToasts.filter((t) => t.id !== id),
        })),

    dailyRecap: null,
    setDailyRecap: (recap) => set({ dailyRecap: recap }),
    showRecapPanel: false,
    toggleRecapPanel: () => set((s) => ({ showRecapPanel: !s.showRecapPanel })),
}));

// ─── Currency Formatter ─────────────────────────────────────

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
    USD: '$', GBP: '£', EUR: '€', AUD: 'A$', CAD: 'C$', INR: '₹',
};

export function formatCurrency(amount: number, code: CurrencyCode = 'USD'): string {
    return `${CURRENCY_SYMBOLS[code]}${amount.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    })}`;
}

// ─── Micro-Copy Generator ───────────────────────────────────

/**
 * Generates contextual, human micro-copy for reward events.
 * This replaces generic event labels with psychologically reinforcing copy
 * that communicates *impact* rather than *action*.
 */
export function generateMicroCopy(
    eventType: LiveEventType,
    metadata?: Record<string, unknown>,
    currency: CurrencyCode = 'USD',
): string {
    const sym = CURRENCY_SYMBOLS[currency];

    switch (eventType) {
        case 'booking_created': {
            const time = metadata?.time as string || '';
            return time
                ? `AI just filled a gap at ${time}`
                : 'AI filled an open slot';
        }
        case 'payment_received': {
            const amount = metadata?.amount as number || 0;
            return `${sym}${amount.toLocaleString()} secured`;
        }
        case 'call_completed': {
            const duration = metadata?.duration_seconds as number || 0;
            const mins = Math.round(duration / 60);
            return mins > 0
                ? `Call handled in ${mins}min — no staff needed`
                : 'Call resolved autonomously';
        }
        case 'missed_call_recovered':
            return 'Missed call recovered → appointment booked';
        case 'appointment_confirmed':
            return 'Appointment confirmed — no-show risk eliminated';
        case 'ai_escalation':
            return 'Needs your attention — AI flagged for review';
        case 'booking_cancelled':
            return 'Slot opened up — AI will auto-fill';
        case 'pms_sync_failure':
            return 'PMS sync interrupted — retrying';
        case 'emergency_hard_stop':
            return 'Emergency protocol activated — calls paused';
        case 'revenue_saved': {
            const amount = metadata?.amount as number || 0;
            return `${sym}${amount.toLocaleString()} in revenue protected`;
        }
        default:
            return String(eventType).replace(/_/g, ' ');
    }
}
