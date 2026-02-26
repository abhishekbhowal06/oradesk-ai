/**
 * ORADESK — REWARD TOAST NOTIFICATION SYSTEM
 *
 * Contextual, impact-focused toast notifications that replace generic event labels.
 * Uses Framer Motion for entry/exit with the micro-system timing tokens.
 *
 * Design:
 *   - Slides in from top-right with scale + opacity
 *   - Auto-dismiss after configured duration
 *   - Icon + micro-copy + subtext
 *   - Stacks cleanly (max 3 visible)
 *   - No casino-style celebration — professional, reinforcing
 *
 * Integration:
 *   All toasts are pushed to the Zustand store (useOraStore.pushRewardToast).
 *   This component renders the queue.
 */

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    DollarSign, CalendarCheck, ShieldCheck, Brain, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toastVariants, TIMING } from '@/lib/animations';
import { useOraStore, type RewardToast } from '@/stores/oraStore';

// ─── Icon Map ───────────────────────────────────────────────

const TOAST_ICONS: Record<RewardToast['icon'], typeof DollarSign> = {
    revenue: DollarSign,
    schedule: CalendarCheck,
    shield: ShieldCheck,
    brain: Brain,
    clock: Clock,
};

const TOAST_COLORS: Record<RewardToast['icon'], { bg: string; icon: string; border: string }> = {
    revenue: {
        bg: 'bg-emerald-50',
        icon: 'text-emerald-600',
        border: 'border-emerald-200',
    },
    schedule: {
        bg: 'bg-primary/5',
        icon: 'text-primary',
        border: 'border-primary/20',
    },
    shield: {
        bg: 'bg-blue-50',
        icon: 'text-blue-600',
        border: 'border-blue-200',
    },
    brain: {
        bg: 'bg-purple-50',
        icon: 'text-purple-600',
        border: 'border-purple-200',
    },
    clock: {
        bg: 'bg-amber-50',
        icon: 'text-amber-600',
        border: 'border-amber-200',
    },
};

// ─── Single Toast Item ──────────────────────────────────────

function RewardToastItem({ toast }: { toast: RewardToast }) {
    const dismissRewardToast = useOraStore((s) => s.dismissRewardToast);
    const colors = TOAST_COLORS[toast.icon];
    const Icon = TOAST_ICONS[toast.icon];

    useEffect(() => {
        const timer = setTimeout(() => {
            dismissRewardToast(toast.id);
        }, toast.autoDismissMs);
        return () => clearTimeout(timer);
    }, [toast.id, toast.autoDismissMs, dismissRewardToast]);

    return (
        <motion.div
            layout
            variants={toastVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
                'flex items-start gap-3 px-4 py-3 rounded-xl border shadow-sm',
                'bg-card backdrop-blur-sm max-w-sm',
                colors.border,
            )}
            role="status"
            aria-live="polite"
        >
            {/* Icon */}
            <div className={cn('p-2 rounded-lg flex-shrink-0', colors.bg)}>
                <Icon className={cn('h-4 w-4', colors.icon)} />
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground leading-snug">
                    {toast.message}
                </p>
                {toast.subtext && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                        {toast.subtext}
                    </p>
                )}
            </div>

            {/* Dismiss */}
            <button
                onClick={() => dismissRewardToast(toast.id)}
                className="text-muted-foreground/50 hover:text-muted-foreground transition-colors p-0.5 -mt-0.5 flex-shrink-0"
                aria-label="Dismiss notification"
            >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                        d="M3 3L9 9M9 3L3 9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                </svg>
            </button>
        </motion.div>
    );
}

// ─── Toast Container ────────────────────────────────────────

export function RewardToastContainer() {
    const rewardToasts = useOraStore((s) => s.rewardToasts);

    return (
        <div
            className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
            aria-label="Notifications"
        >
            <AnimatePresence mode="popLayout">
                {rewardToasts.slice(0, 3).map((toast) => (
                    <div key={toast.id} className="pointer-events-auto">
                        <RewardToastItem toast={toast} />
                    </div>
                ))}
            </AnimatePresence>
        </div>
    );
}
