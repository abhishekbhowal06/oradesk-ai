/**
 * ORADESK — REWARD TRIGGER ENGINE
 *
 * Hooks that monitor real data changes and fire reward animations.
 * This is the bridge between server state (React Query) and UI reinforcement (Zustand).
 *
 * Trigger Rules:
 *   1. Revenue increase    → count-up + revenue glow + toast
 *   2. Schedule fill ↑     → progress fill animation + toast (if crosses threshold)
 *   3. Urgent count ↓      → risk relief (red→green) + shield toast
 *   4. AI confidence ↑     → subtle highlight + brain toast (only at milestones)
 *   5. Staff hours saved   → periodic clock toast (every 2h saved)
 *
 * Safety:
 *   - All triggers are debounced (300ms)
 *   - Animation hierarchy is respected
 *   - respects prefers-reduced-motion
 *   - WebSocket-safe: merges rapid updates
 */

import { useEffect, useRef, useCallback } from 'react';
import {
    debounceAnimationTrigger,
    requestAnimationSlot,
    releaseAnimationSlot,
    AnimationWeight,
    prefersReducedMotion,
} from '@/lib/animations';
import {
    useOraStore,
    formatCurrency,
    generateMicroCopy,
    type RewardTrigger,
    type RewardToast,
    type CurrencyCode,
} from '@/stores/oraStore';

// ─── Utility: Generate unique ID ────────────────────────────

let toastIdCounter = 0;
function nextToastId(): string {
    return `reward-toast-${Date.now()}-${++toastIdCounter}`;
}

// ─── Main Engine Hook ───────────────────────────────────────

/**
 * Place this hook ONCE at the top of the Dashboard page.
 * It monitors data from React Query hooks (passed as params)
 * and triggers animations/toasts when positive changes are detected.
 */
export function useRewardTriggerEngine(data: {
    revenueToday: number;
    scheduleFillPct: number;
    urgentCount: number;
    aiConfidence: number;
    staffHoursSaved: number;
    currency: CurrencyCode;
}) {
    const {
        kpiSnapshot,
        updateKpiSnapshot,
        triggerAnimation,
        pushRewardTrigger,
        pushRewardToast,
    } = useOraStore();

    const isInitialized = useRef(false);
    const prevData = useRef(data);

    // ── Fire reward triggers on data changes ──────────────────

    useEffect(() => {
        // Skip first render (initial data load) — no animation on mount
        if (!isInitialized.current) {
            isInitialized.current = true;
            updateKpiSnapshot({
                revenueToday: data.revenueToday,
                scheduleFillPct: data.scheduleFillPct,
                urgentCount: data.urgentCount,
                aiConfidence: data.aiConfidence,
                staffHoursSaved: data.staffHoursSaved,
            });
            prevData.current = data;
            return;
        }

        if (prefersReducedMotion()) return;

        const prev = prevData.current;
        const sym = formatCurrency(0, data.currency).charAt(0);

        // ── TRIGGER 1: Revenue Increase ───────────────────────────
        if (data.revenueToday > prev.revenueToday) {
            debounceAnimationTrigger('revenue', () => {
                if (!requestAnimationSlot(AnimationWeight.REVENUE)) return;

                const delta = data.revenueToday - prev.revenueToday;

                triggerAnimation('revenueGlow', 2500);
                triggerAnimation('activeCountUp', 1000);

                pushRewardTrigger({
                    type: 'revenue_increase',
                    timestamp: Date.now(),
                    previousValue: prev.revenueToday,
                    newValue: data.revenueToday,
                    delta,
                    message: `${sym}${delta.toLocaleString()} added to today's revenue`,
                });

                pushRewardToast({
                    id: nextToastId(),
                    type: 'revenue_increase',
                    message: `${sym}${delta.toLocaleString()} secured`,
                    subtext: `Total today: ${formatCurrency(data.revenueToday, data.currency)}`,
                    icon: 'revenue',
                    timestamp: Date.now(),
                    autoDismissMs: 4000,
                });

                setTimeout(() => releaseAnimationSlot(), 2500);
            });
        }

        // ── TRIGGER 2: Schedule Fill Increase ─────────────────────
        if (data.scheduleFillPct > prev.scheduleFillPct) {
            debounceAnimationTrigger('schedule', () => {
                triggerAnimation('scheduleFillAnimating', 1500);

                const delta = data.scheduleFillPct - prev.scheduleFillPct;

                pushRewardTrigger({
                    type: 'slot_filled',
                    timestamp: Date.now(),
                    previousValue: prev.scheduleFillPct,
                    newValue: data.scheduleFillPct,
                    delta,
                    message: `Schedule fill increased to ${data.scheduleFillPct}%`,
                });

                // Only toast when crossing thresholds: 50%, 75%, 90%, 100%
                const thresholds = [50, 75, 90, 100];
                const crossedThreshold = thresholds.find(
                    (t) => prev.scheduleFillPct < t && data.scheduleFillPct >= t,
                );

                if (crossedThreshold) {
                    pushRewardToast({
                        id: nextToastId(),
                        type: 'slot_filled',
                        message: crossedThreshold === 100
                            ? 'Schedule fully booked'
                            : `Schedule ${crossedThreshold}% filled`,
                        subtext: crossedThreshold === 100
                            ? 'Maximum capacity reached — every slot earning'
                            : `${100 - data.scheduleFillPct}% remaining`,
                        icon: 'schedule',
                        timestamp: Date.now(),
                        autoDismissMs: 4000,
                    });
                }
            });
        }

        // ── TRIGGER 3: Risk Resolved (urgent count decrease) ─────
        if (data.urgentCount < prev.urgentCount) {
            debounceAnimationTrigger('risk', () => {
                if (!requestAnimationSlot(AnimationWeight.RISK_RELIEF)) return;

                const resolved = prev.urgentCount - data.urgentCount;

                triggerAnimation('riskReliefActive', 2000);

                pushRewardTrigger({
                    type: 'risk_resolved',
                    timestamp: Date.now(),
                    previousValue: prev.urgentCount,
                    newValue: data.urgentCount,
                    delta: -resolved,
                    message: `${resolved} urgent ${resolved === 1 ? 'issue' : 'issues'} resolved`,
                });

                if (data.urgentCount === 0) {
                    pushRewardToast({
                        id: nextToastId(),
                        type: 'risk_resolved',
                        message: 'All urgent issues resolved',
                        subtext: 'Zero open risks — AI is fully autonomous',
                        icon: 'shield',
                        timestamp: Date.now(),
                        autoDismissMs: 5000,
                    });
                } else {
                    pushRewardToast({
                        id: nextToastId(),
                        type: 'risk_resolved',
                        message: `${resolved} risk${resolved > 1 ? 's' : ''} resolved`,
                        subtext: `${data.urgentCount} remaining`,
                        icon: 'shield',
                        timestamp: Date.now(),
                        autoDismissMs: 3500,
                    });
                }

                setTimeout(() => releaseAnimationSlot(), 2000);
            });
        }

        // ── TRIGGER 4: AI Confidence Increase ────────────────────
        if (data.aiConfidence > prev.aiConfidence) {
            debounceAnimationTrigger('confidence', () => {
                triggerAnimation('confidenceHighlight', 1500);

                pushRewardTrigger({
                    type: 'ai_confidence_up',
                    timestamp: Date.now(),
                    previousValue: prev.aiConfidence,
                    newValue: data.aiConfidence,
                    delta: data.aiConfidence - prev.aiConfidence,
                    message: `AI confidence: ${(data.aiConfidence * 100).toFixed(0)}%`,
                });

                // Only toast at milestones: 80%, 90%, 95%
                const milestones = [0.8, 0.9, 0.95];
                const crossedMilestone = milestones.find(
                    (m) => prev.aiConfidence < m && data.aiConfidence >= m,
                );

                if (crossedMilestone) {
                    pushRewardToast({
                        id: nextToastId(),
                        type: 'ai_confidence_up',
                        message: `AI performance at ${(crossedMilestone * 100).toFixed(0)}%`,
                        subtext: 'Consistently improving call handling',
                        icon: 'brain',
                        timestamp: Date.now(),
                        autoDismissMs: 4000,
                    });
                }
            });
        }

        // ── TRIGGER 5: Staff Hours Saved ─────────────────────────
        if (data.staffHoursSaved > prev.staffHoursSaved) {
            debounceAnimationTrigger('hours', () => {
                const delta = data.staffHoursSaved - prev.staffHoursSaved;

                pushRewardTrigger({
                    type: 'staff_hours_saved',
                    timestamp: Date.now(),
                    previousValue: prev.staffHoursSaved,
                    newValue: data.staffHoursSaved,
                    delta,
                    message: `${delta.toFixed(1)}h staff time saved`,
                });

                // Toast every 2 hours saved
                const prevWholeHours = Math.floor(prev.staffHoursSaved / 2);
                const newWholeHours = Math.floor(data.staffHoursSaved / 2);

                if (newWholeHours > prevWholeHours) {
                    pushRewardToast({
                        id: nextToastId(),
                        type: 'staff_hours_saved',
                        message: `${data.staffHoursSaved.toFixed(1)}h of staff time saved today`,
                        subtext: 'Your AI is handling the workload',
                        icon: 'clock',
                        timestamp: Date.now(),
                        autoDismissMs: 4000,
                    });
                }
            });
        }

        // Update snapshot
        updateKpiSnapshot({
            revenueToday: data.revenueToday,
            scheduleFillPct: data.scheduleFillPct,
            urgentCount: data.urgentCount,
            aiConfidence: data.aiConfidence,
            staffHoursSaved: data.staffHoursSaved,
        });
        prevData.current = data;
    }, [
        data.revenueToday,
        data.scheduleFillPct,
        data.urgentCount,
        data.aiConfidence,
        data.staffHoursSaved,
    ]);
}
