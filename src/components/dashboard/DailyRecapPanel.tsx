/**
 * ORADESK — DAILY PERFORMANCE RECAP PANEL
 *
 * Layer 4 Dopamine Reinforcement: Daily Performance Summary
 *
 * Design:
 *   - Collapsible panel at top of dashboard
 *   - Shows today's key achievements with count-up animations
 *   - Highlights the single "top win" of the day
 *   - Uses soft emerald/teal palette — healthcare-grade trust
 *   - No gamification badges or cartoon elements
 *
 * Data:
 *   Reads from useOraStore.dailyRecap (populated by API or calculated from KPIs)
 */

import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    TrendingUp, CalendarCheck, ShieldCheck, Bot, Clock,
    ChevronDown, Award, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    recapPanelVariants,
    staggerContainerVariants,
    staggerChildVariants,
    TIMING,
} from '@/lib/animations';
import { useOraStore, formatCurrency } from '@/stores/oraStore';
import { AnimatedCountUp } from './AnimatedCountUp';

// ─── Recap Metric Card ──────────────────────────────────────

interface RecapMetricProps {
    label: string;
    value: number;
    prefix?: string;
    suffix?: string;
    icon: React.ReactNode;
    subtext: string;
    accentClass: string;
}

function RecapMetric({
    label, value, prefix, suffix, icon, subtext, accentClass,
}: RecapMetricProps) {
    return (
        <motion.div
            variants={staggerChildVariants}
            className="flex items-center gap-3 py-3"
        >
            <div className={cn('p-2 rounded-lg flex-shrink-0', accentClass)}>
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-lg font-bold text-foreground tabular-nums">
                    <AnimatedCountUp
                        value={value}
                        prefix={prefix}
                        suffix={suffix}
                        duration={1000}
                        enableGlow={false}
                    />
                </p>
                <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                    {label}
                </p>
            </div>
            <span className="text-[10px] text-muted-foreground">{subtext}</span>
        </motion.div>
    );
}

// ─── Main Panel ─────────────────────────────────────────────

export const DailyRecapPanel = memo(function DailyRecapPanel() {
    const { dailyRecap, showRecapPanel, toggleRecapPanel } = useOraStore();
    const currencyMode = useOraStore((s) => s.currencyMode);

    // Don't render if no recap data
    if (!dailyRecap) return null;

    const fillPct = dailyRecap.slotsTotal > 0
        ? Math.round((dailyRecap.slotsFilled / dailyRecap.slotsTotal) * 100)
        : 0;

    return (
        <div className="relative">
            {/* Toggle Button */}
            <button
                onClick={toggleRecapPanel}
                className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200',
                    showRecapPanel
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'bg-card border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/20',
                )}
            >
                <Award className="h-3.5 w-3.5" />
                Today's Performance
                <ChevronDown
                    className={cn(
                        'h-3 w-3 transition-transform duration-200',
                        showRecapPanel && 'rotate-180',
                    )}
                />
            </button>

            {/* Panel */}
            <AnimatePresence>
                {showRecapPanel && (
                    <motion.div
                        variants={recapPanelVariants}
                        initial="collapsed"
                        animate="expanded"
                        exit="collapsed"
                        className="mt-3 bg-card border border-border/60 rounded-xl overflow-hidden"
                    >
                        <div className="p-5">
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-sm font-bold text-foreground">
                                        Daily Summary
                                    </h3>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        Your AI's impact today
                                    </p>
                                </div>
                                <button
                                    onClick={toggleRecapPanel}
                                    className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
                                    aria-label="Close panel"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Top Achievement Banner */}
                            {dailyRecap.topAchievement && (
                                <motion.div
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.22, delay: 0.1 }}
                                    className="mb-4 px-4 py-3 bg-primary/5 border border-primary/15 rounded-lg"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-primary/10 rounded-md">
                                            <TrendingUp className="h-3.5 w-3.5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-primary">
                                                Top Win
                                            </p>
                                            <p className="text-[11px] text-foreground mt-0.5">
                                                {dailyRecap.topAchievement}
                                            </p>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* Metrics Grid */}
                            <motion.div
                                variants={staggerContainerVariants}
                                initial="hidden"
                                animate="visible"
                                className="grid grid-cols-2 lg:grid-cols-5 gap-x-6 divide-x divide-border/30"
                            >
                                <RecapMetric
                                    label="Revenue"
                                    value={dailyRecap.revenueToday}
                                    prefix={formatCurrency(0, currencyMode).charAt(0)}
                                    icon={<TrendingUp className="h-4 w-4 text-emerald-600" />}
                                    subtext={dailyRecap.revenueDelta > 0 ? `+${dailyRecap.revenueDelta}%` : `${dailyRecap.revenueDelta}%`}
                                    accentClass="bg-emerald-50"
                                />
                                <div className="pl-6">
                                    <RecapMetric
                                        label="Slots Filled"
                                        value={dailyRecap.slotsFilled}
                                        suffix={`/${dailyRecap.slotsTotal}`}
                                        icon={<CalendarCheck className="h-4 w-4 text-primary" />}
                                        subtext={`${fillPct}% fill`}
                                        accentClass="bg-primary/10"
                                    />
                                </div>
                                <div className="pl-6">
                                    <RecapMetric
                                        label="Risks Resolved"
                                        value={dailyRecap.risksResolved}
                                        icon={<ShieldCheck className="h-4 w-4 text-blue-600" />}
                                        subtext={dailyRecap.risksRemaining > 0 ? `${dailyRecap.risksRemaining} remaining` : 'All clear'}
                                        accentClass="bg-blue-50"
                                    />
                                </div>
                                <div className="pl-6">
                                    <RecapMetric
                                        label="AI Calls"
                                        value={dailyRecap.aiCallsHandled}
                                        icon={<Bot className="h-4 w-4 text-purple-600" />}
                                        subtext="handled"
                                        accentClass="bg-purple-50"
                                    />
                                </div>
                                <div className="pl-6">
                                    <RecapMetric
                                        label="Hours Saved"
                                        value={dailyRecap.staffHoursSaved}
                                        suffix="h"
                                        icon={<Clock className="h-4 w-4 text-amber-600" />}
                                        subtext="staff time"
                                        accentClass="bg-amber-50"
                                    />
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
});
