/**
 * ORADESK AI — ANIMATION MICRO-SYSTEM
 *
 * Performance Psychology Architecture:
 *   Layer 1: Micro reinforcement (count-up, value glow)
 *   Layer 2: Progress reinforcement (fill bars, completion badges)
 *   Layer 3: Risk relief (red→green transforms, urgency de-escalation)
 *   Layer 4: Daily performance summary (recap panel, trend confirmation)
 *
 * Constraints:
 *   - All transitions: 150–280ms
 *   - Easing: cubic-bezier(0.33, 1, 0.68, 1) — ease-out cubic
 *   - No simultaneous high-weight animations
 *   - Accessible: respects prefers-reduced-motion
 *   - WebSocket safe: debounced animation triggers
 *   - 60fps budget: GPU-accelerated properties only (transform, opacity)
 */

import type { Transition, Variants, TargetAndTransition } from 'framer-motion';

// ═══════════════════════════════════════════════════════════
// EASING & TIMING CONSTANTS
// ═══════════════════════════════════════════════════════════

/** Primary ease-out cubic for all reward animations */
export const EASE_OUT_CUBIC = [0.33, 1, 0.68, 1] as [number, number, number, number];

/** Timing tiers (ms) — maps to psychological impact weight */
export const TIMING = {
    /** Micro feedback: badge appear, icon swap */
    INSTANT: 0.15,
    /** Value changes: count-up, progress fill */
    STANDARD: 0.22,
    /** State transforms: risk resolution, panel transitions */
    EMPHASIS: 0.28,
    /** Glow pulse cycle — one full breath */
    GLOW_CYCLE: 2.0,
    /** Count-up animation total duration */
    COUNT_UP: 0.8,
    /** Stagger delay between child elements */
    STAGGER: 0.05,
} as const;

// ═══════════════════════════════════════════════════════════
// ANIMATION HIERARCHY (Priority Queue)
// ═══════════════════════════════════════════════════════════

/**
 * Animation weight determines render priority.
 * Only ONE weight-4+ animation can run at a time.
 * Lower weight animations queue behind higher ones.
 */
export enum AnimationWeight {
    /** Background: subtle breathe, idle indicators */
    AMBIENT = 1,
    /** Feed item slide-in, list append */
    FEED = 2,
    /** Progress bar fill, schedule gauge */
    PROGRESS = 3,
    /** Risk resolution (red→green), urgent count change */
    RISK_RELIEF = 4,
    /** Revenue increase, financial KPI change */
    REVENUE = 5,
}

/** Currently active high-weight animation slot */
let activeHighWeightAnimation: AnimationWeight | null = null;
const animationQueue: Array<{ weight: AnimationWeight; callback: () => void }> = [];

/**
 * Request animation slot. Returns true if animation can proceed immediately.
 * High-weight animations (4+) are serialized to prevent visual overload.
 */
export function requestAnimationSlot(weight: AnimationWeight): boolean {
    if (weight < AnimationWeight.RISK_RELIEF) return true; // Low weight = always allowed

    if (activeHighWeightAnimation === null || weight >= activeHighWeightAnimation) {
        activeHighWeightAnimation = weight;
        return true;
    }
    return false;
}

export function releaseAnimationSlot(): void {
    activeHighWeightAnimation = null;
    // Process queue
    if (animationQueue.length > 0) {
        const next = animationQueue.shift();
        if (next) {
            activeHighWeightAnimation = next.weight;
            next.callback();
        }
    }
}

export function queueAnimation(weight: AnimationWeight, callback: () => void): void {
    animationQueue.push({ weight, callback });
    animationQueue.sort((a, b) => b.weight - a.weight);
}

// ═══════════════════════════════════════════════════════════
// TRANSITION PRESETS
// ═══════════════════════════════════════════════════════════

export const transitions = {
    /** For card entry, KPI appearance */
    fadeUp: {
        duration: TIMING.STANDARD,
        ease: EASE_OUT_CUBIC,
    } satisfies Transition,

    /** For value count-up finalization */
    countUp: {
        duration: TIMING.COUNT_UP,
        ease: EASE_OUT_CUBIC,
    } satisfies Transition,

    /** For progress bar fill */
    progressFill: {
        duration: 0.6,
        ease: EASE_OUT_CUBIC,
    } satisfies Transition,

    /** For risk-to-safe state transform */
    riskRelief: {
        duration: TIMING.EMPHASIS,
        ease: EASE_OUT_CUBIC,
    } satisfies Transition,

    /** For badge/pill transforms */
    badgeTransform: {
        duration: TIMING.INSTANT,
        ease: EASE_OUT_CUBIC,
    } satisfies Transition,

    /** For soft glow pulse on value change */
    glowPulse: {
        duration: TIMING.GLOW_CYCLE,
        ease: 'easeInOut' as const,
        repeat: 2,
    } satisfies Transition,

    /** Stagger children in a list */
    staggerContainer: {
        staggerChildren: TIMING.STAGGER,
        delayChildren: 0.1,
    },

    /** For toast/notification entry */
    toastEntry: {
        duration: TIMING.STANDARD,
        ease: EASE_OUT_CUBIC,
    } satisfies Transition,

    /** For panels sliding in/out */
    panelSlide: {
        duration: TIMING.EMPHASIS,
        ease: EASE_OUT_CUBIC,
    } satisfies Transition,
} as const;

// ═══════════════════════════════════════════════════════════
// FRAMER MOTION VARIANT SETS
// ═══════════════════════════════════════════════════════════

/** Card entry with fade + subtle upward translate */
export const cardVariants: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
        opacity: 1,
        y: 0,
        transition: transitions.fadeUp,
    },
    hover: {
        y: -2,
        transition: { duration: TIMING.INSTANT, ease: EASE_OUT_CUBIC },
    },
};

/** KPI value update — scale bump + glow */
export const kpiValueVariants: Variants = {
    idle: { scale: 1 },
    updated: {
        scale: [1, 1.04, 1],
        transition: {
            duration: TIMING.STANDARD,
            ease: EASE_OUT_CUBIC,
            times: [0, 0.4, 1],
        },
    },
};

/** Glow ring around value that just changed */
export const glowVariants: Variants = {
    idle: {
        boxShadow: '0 0 0px 0px rgba(16, 185, 129, 0)',
    },
    active: {
        boxShadow: [
            '0 0 0px 0px rgba(16, 185, 129, 0)',
            '0 0 16px 4px rgba(16, 185, 129, 0.15)',
            '0 0 0px 0px rgba(16, 185, 129, 0)',
        ],
        transition: transitions.glowPulse,
    },
};

/** Revenue glow — distinct teal/gold blend */
export const revenueGlowVariants: Variants = {
    idle: {
        boxShadow: '0 0 0px 0px rgba(13, 94, 94, 0)',
    },
    active: {
        boxShadow: [
            '0 0 0px 0px rgba(13, 94, 94, 0)',
            '0 0 20px 6px rgba(13, 94, 94, 0.12)',
            '0 0 0px 0px rgba(13, 94, 94, 0)',
        ],
        transition: transitions.glowPulse,
    },
};

/** Risk badge: red → green color morph */
export const riskReliefVariants: Variants = {
    risk: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderColor: 'rgba(239, 68, 68, 0.3)',
        color: 'rgb(239, 68, 68)',
    },
    safe: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgba(16, 185, 129, 0.3)',
        color: 'rgb(16, 185, 129)',
        transition: transitions.riskRelief,
    },
};

/** Badge scale-in for achievements */
export const badgeVariants: Variants = {
    hidden: { scale: 0, opacity: 0 },
    visible: {
        scale: 1,
        opacity: 1,
        transition: {
            ...transitions.badgeTransform,
            type: 'spring',
            stiffness: 400,
            damping: 20,
        },
    },
};

/** Feed item slide-in from left */
export const feedItemVariants: Variants = {
    hidden: { opacity: 0, x: -16, height: 0 },
    visible: {
        opacity: 1,
        x: 0,
        height: 'auto',
        transition: transitions.fadeUp,
    },
    exit: {
        opacity: 0,
        height: 0,
        transition: { duration: TIMING.INSTANT },
    },
};

/** Toast notification entry from top-right */
export const toastVariants: Variants = {
    hidden: { opacity: 0, y: -12, x: 20, scale: 0.95 },
    visible: {
        opacity: 1,
        y: 0,
        x: 0,
        scale: 1,
        transition: transitions.toastEntry,
    },
    exit: {
        opacity: 0,
        y: -8,
        scale: 0.95,
        transition: { duration: TIMING.INSTANT },
    },
};

/** Daily recap panel expand */
export const recapPanelVariants: Variants = {
    collapsed: { height: 0, opacity: 0, overflow: 'hidden' },
    expanded: {
        height: 'auto',
        opacity: 1,
        transition: transitions.panelSlide,
    },
};

/** Stagger container for lists */
export const staggerContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: transitions.staggerContainer,
    },
};

/** Individual stagger child */
export const staggerChildVariants: Variants = {
    hidden: { opacity: 0, y: 8 },
    visible: {
        opacity: 1,
        y: 0,
        transition: transitions.fadeUp,
    },
};

// ═══════════════════════════════════════════════════════════
// COUNT-UP ANIMATION LOGIC
// ═══════════════════════════════════════════════════════════

/**
 * Eased count-up using requestAnimationFrame.
 * Uses ease-out cubic for natural deceleration.
 *
 * @param from - Starting number
 * @param to - Target number
 * @param duration - Duration in ms (default 800ms)
 * @param onUpdate - Callback with current interpolated value
 * @param onComplete - Callback when animation finishes
 * @returns Cleanup function to cancel animation
 */
export function animateCountUp(
    from: number,
    to: number,
    duration: number = 800,
    onUpdate: (value: number) => void,
    onComplete?: () => void,
): () => void {
    let startTime: number | null = null;
    let rafId: number;
    let cancelled = false;

    function easeOutCubic(t: number): number {
        return 1 - Math.pow(1 - t, 3);
    }

    function tick(timestamp: number): void {
        if (cancelled) return;

        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeOutCubic(progress);
        const current = from + (to - from) * easedProgress;

        onUpdate(current);

        if (progress < 1) {
            rafId = requestAnimationFrame(tick);
        } else {
            onUpdate(to); // Ensure exact final value
            onComplete?.();
        }
    }

    rafId = requestAnimationFrame(tick);

    return () => {
        cancelled = true;
        cancelAnimationFrame(rafId);
    };
}

// ═══════════════════════════════════════════════════════════
// ACCESSIBILITY: REDUCED MOTION SUPPORT
// ═══════════════════════════════════════════════════════════

/**
 * Returns true if user prefers reduced motion.
 * All animation components should check this and skip animations.
 */
export function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Returns animation props stripped down if reduced motion is preferred.
 * Use this wrapper for all Framer Motion animate props.
 */
export function safeAnimate(
    props: TargetAndTransition,
): TargetAndTransition | undefined {
    if (prefersReducedMotion()) return undefined;
    return props;
}

// ═══════════════════════════════════════════════════════════
// DEBOUNCE FOR WEBSOCKET ANIMATION TRIGGERS
// ═══════════════════════════════════════════════════════════

const animationDebounceMap = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Debounces animation triggers to prevent jitter from rapid WebSocket updates.
 * Groups rapid-fire updates into a single animation cycle.
 *
 * @param key - Unique identifier for the animation source (e.g., 'revenue_today')
 * @param callback - Animation trigger function
 * @param delayMs - Debounce window (default 300ms)
 */
export function debounceAnimationTrigger(
    key: string,
    callback: () => void,
    delayMs: number = 300,
): void {
    const existing = animationDebounceMap.get(key);
    if (existing) clearTimeout(existing);

    animationDebounceMap.set(
        key,
        setTimeout(() => {
            callback();
            animationDebounceMap.delete(key);
        }, delayMs),
    );
}
