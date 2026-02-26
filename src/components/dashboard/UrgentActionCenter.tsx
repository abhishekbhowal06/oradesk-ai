import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ChevronRight, CheckCircle2, UserCheck, Clock } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAICalls } from '@/hooks/useAICalls';
import { useOraStore } from '@/stores/oraStore';
import { cardVariants, TIMING, EASE_OUT_CUBIC } from '@/lib/animations';

export function UrgentActionCenter() {
    const { calls } = useAICalls();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const animationState = useOraStore((s) => s.animationState);

    const urgentItems = useMemo(() => {
        return calls
            .filter((c) => c.escalation_required || c.status === 'failed')
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 6);
    }, [calls]);

    const severityColor = (call: any) => {
        if (call.escalation_reason?.includes('Emergency')) return 'border-l-red-500';
        if (call.status === 'failed') return 'border-l-amber-500';
        return 'border-l-primary';
    };

    return (
        <motion.div
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            className="bg-card border border-border/60 rounded-xl"
        >
            <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-destructive" />
                    Urgent Actions
                    {urgentItems.length > 0 && (
                        <motion.span
                            key={urgentItems.length}
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: TIMING.INSTANT, ease: EASE_OUT_CUBIC }}
                            className="bg-destructive text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                        >
                            {urgentItems.length}
                        </motion.span>
                    )}
                </h3>
            </div>

            <div className="divide-y divide-border/20">
                {urgentItems.length === 0 ? (
                    <motion.div
                        className="px-5 py-6 text-center"
                        // Risk relief animation: card briefly glows green when clearing
                        animate={animationState.riskReliefActive ? {
                            backgroundColor: ['rgba(16, 185, 129, 0)', 'rgba(16, 185, 129, 0.04)', 'rgba(16, 185, 129, 0)'],
                        } : {}}
                        transition={{ duration: 1.5 }}
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            transition={{ duration: TIMING.STANDARD, ease: EASE_OUT_CUBIC }}
                        >
                            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                        </motion.div>
                        <p className="text-sm font-semibold text-foreground">All Clear</p>
                        <p className="text-xs text-muted-foreground mt-1">No urgent items. Your AI is handling everything.</p>
                    </motion.div>
                ) : (
                    urgentItems.map((item) => (
                        <motion.div
                            key={item.id}
                            className={cn("px-5 py-3 border-l-3 cursor-pointer hover:bg-secondary/20 transition-colors", severityColor(item))}
                            onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                            layout
                        >
                            <div className="flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold text-foreground truncate">
                                        {item.escalation_reason || `Call ${item.status}`}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        {formatDistanceToNow(parseISO(item.created_at), { addSuffix: true })}
                                    </p>
                                </div>
                                <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", expandedId === item.id && "rotate-90")} />
                            </div>

                            {/* Expanded actions */}
                            <AnimatePresence>
                                {expandedId === item.id && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: TIMING.STANDARD, ease: EASE_OUT_CUBIC }}
                                        className="flex gap-2 mt-3 overflow-hidden"
                                    >
                                        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1">
                                            <UserCheck className="h-3 w-3" /> Assign
                                        </Button>
                                        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1">
                                            <Clock className="h-3 w-3" /> Snooze
                                        </Button>
                                        <Button size="sm" className="h-7 text-[10px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                                            <CheckCircle2 className="h-3 w-3" /> Resolve
                                        </Button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))
                )}
            </div>
        </motion.div>
    );
}
