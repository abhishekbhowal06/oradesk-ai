import React from 'react';
import { motion } from 'framer-motion';
import { Zap } from 'lucide-react';
import { useROIMetrics } from '@/hooks/useROIMetrics';
import { useOraStore, formatCurrency } from '@/stores/oraStore';
import { AnimatedCountUp } from '@/components/dashboard/AnimatedCountUp';
import { cardVariants, staggerContainerVariants, staggerChildVariants } from '@/lib/animations';

export function ProductivityImpact() {
    const { data: roi } = useROIMetrics();
    const currencyMode = useOraStore((s) => s.currencyMode);
    const hoursSaved = roi?.staffHoursSaved ?? 0;
    const avgHourlyRate = 28; // $28/hr average receptionist wage
    const salaryValue = hoursSaved * avgHourlyRate;
    const efficiencyScore = roi?.callSuccessRate ?? 0;

    return (
        <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="bg-card border border-border/60 rounded-xl p-5"
        >
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-primary" />
                Productivity Impact
            </h3>

            <motion.div
                variants={staggerContainerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-3 gap-4"
            >
                <motion.div variants={staggerChildVariants} className="text-center space-y-1">
                    <p className="text-xl font-bold text-foreground">
                        <AnimatedCountUp
                            value={hoursSaved}
                            suffix="h"
                            decimals={1}
                            enableGlow={false}
                        />
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Staff Hours Saved</p>
                </motion.div>
                <motion.div variants={staggerChildVariants} className="text-center space-y-1 border-x border-border/30 px-2">
                    <p className="text-xl font-bold text-emerald-600">
                        <AnimatedCountUp
                            value={salaryValue}
                            prefix={formatCurrency(0, currencyMode).charAt(0)}
                            enableGlow={false}
                            glowColor="rgba(16, 185, 129, 0.15)"
                        />
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Salary Equivalent</p>
                </motion.div>
                <motion.div variants={staggerChildVariants} className="text-center space-y-1">
                    <p className="text-xl font-bold text-primary">
                        <AnimatedCountUp
                            value={Math.round(efficiencyScore * 100)}
                            suffix="%"
                            enableGlow={false}
                        />
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">AI Efficiency</p>
                </motion.div>
            </motion.div>
        </motion.div>
    );
}
