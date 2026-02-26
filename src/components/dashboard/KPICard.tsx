import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { AnimatedCountUp } from '@/components/dashboard/AnimatedCountUp';
import { useOraStore } from '@/stores/oraStore';
import { cardVariants, TIMING, EASE_OUT_CUBIC, transitions } from '@/lib/animations';

export interface KPICardProps {
    label: string;
    value: number;
    formattedValue: string;
    subtext: string;
    delta?: number;
    icon: React.ReactNode;
    accentColor: string;
    sparklineData?: number[];
    riskThreshold?: number;
    currentPct?: number;
    emptyExplanation?: string;
    countUp?: boolean;
    countUpPrefix?: string;
    countUpSuffix?: string;
    glowColor?: string;
    isRevenue?: boolean;
    isRisk?: boolean;
    countUpDecimals?: number;
}

export function KPICard({
    label, value, formattedValue, subtext, delta, icon, accentColor,
    sparklineData, riskThreshold, currentPct, emptyExplanation,
    countUp = false, countUpPrefix = '', countUpSuffix = '', glowColor,
    isRevenue = false, isRisk = false, countUpDecimals = 0,
}: KPICardProps) {
    const animationState = useOraStore((s) => s.animationState);
    const isZero = value === 0;
    const isAtRisk = riskThreshold !== undefined && currentPct !== undefined && currentPct < riskThreshold;

    // Determine glow state
    const isGlowing = isRevenue
        ? animationState.revenueGlow
        : isRisk
            ? animationState.riskReliefActive
            : false;

    return (
        <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            whileHover="hover"
            className={cn(
                "bg-card border rounded-xl p-5 flex flex-col justify-between transition-all relative overflow-hidden group",
                isAtRisk ? "border-amber-300 bg-amber-50/30" : "border-border/60",
            )}
        >
            {/* Glow overlay — appears on value increase */}
            <AnimatePresence>
                {isGlowing && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 pointer-events-none rounded-xl"
                        style={{
                            boxShadow: isRevenue
                                ? 'inset 0 0 30px rgba(16, 185, 129, 0.08), 0 0 20px rgba(16, 185, 129, 0.06)'
                                : isRisk
                                    ? 'inset 0 0 30px rgba(59, 130, 246, 0.08), 0 0 20px rgba(59, 130, 246, 0.06)'
                                    : 'none',
                        }}
                    />
                )}
            </AnimatePresence>

            {/* Header */}
            <div className="flex items-start justify-between relative z-10">
                <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
                    <div className={cn("text-2xl font-bold tracking-tight", isZero ? "text-muted-foreground" : "text-foreground")}>
                        {countUp && !isZero ? (
                            <AnimatedCountUp
                                value={value}
                                prefix={countUpPrefix}
                                suffix={countUpSuffix}
                                decimals={countUpDecimals}
                                glowColor={glowColor || 'rgba(16, 185, 129, 0.15)'}
                                enableGlow={isRevenue}
                            />
                        ) : (
                            formattedValue
                        )}
                    </div>
                </div>
                <motion.div
                    className={cn("p-2 rounded-lg", accentColor)}
                    animate={isGlowing ? { scale: [1, 1.08, 1] } : {}}
                    transition={{ duration: TIMING.STANDARD, ease: EASE_OUT_CUBIC }}
                >
                    {icon}
                </motion.div>
            </div>

            {/* Zero State */}
            {isZero && emptyExplanation && (
                <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">{emptyExplanation}</p>
            )}

            {/* Sparkline */}
            {sparklineData && sparklineData.length > 0 && !isZero && (
                <div className="h-8 mt-3 -mx-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sparklineData.map((v, i) => ({ i, v }))}>
                            <defs>
                                <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={1.5} fill={`url(#spark-${label})`} dot={false} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* Gauge (for schedule fill) */}
            {currentPct !== undefined && (
                <div className="mt-3 space-y-1.5">
                    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                        <motion.div
                            className={cn("h-full rounded-full", isAtRisk ? "bg-amber-500" : "bg-primary")}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(currentPct, 100)}%` }}
                            transition={transitions.progressFill}
                        />
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30 relative z-10">
                {delta !== undefined && delta !== 0 && (
                    <motion.span
                        className={cn(
                            "inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md",
                            delta > 0 ? "text-emerald-600 bg-emerald-50" : "text-red-500 bg-red-50",
                        )}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: TIMING.INSTANT, ease: EASE_OUT_CUBIC }}
                    >
                        {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {delta > 0 ? '+' : ''}{delta}%
                    </motion.span>
                )}
                <span className="text-[11px] text-muted-foreground">{subtext}</span>
            </div>
        </motion.div>
    );
}
