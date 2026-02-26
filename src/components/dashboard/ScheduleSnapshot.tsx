import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calendar, ChevronRight, CheckCircle2, RefreshCw, Phone } from 'lucide-react';
import { isToday, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAppointments } from '@/hooks/useAppointments';
import { LoadingState } from '@/components/states/LoadingState';
import { EmptyState } from '@/components/states/EmptyState';
import { cardVariants, TIMING, EASE_OUT_CUBIC } from '@/lib/animations';

export function ScheduleSnapshot() {
    const { appointments, isLoading } = useAppointments();

    const todaySlots = useMemo(() => {
        if (!appointments) return [];
        return appointments
            .filter((a: any) => isToday(parseISO(a.date)))
            .sort((a: any, b: any) => a.start_time.localeCompare(b.start_time))
            .slice(0, 8);
    }, [appointments]);

    const statusColors: Record<string, string> = {
        confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        pending: 'bg-amber-50 text-amber-700 border-amber-200',
        cancelled: 'bg-red-50 text-red-500 border-red-200',
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
                    <Calendar className="h-4 w-4 text-primary" />
                    Today's Schedule
                </h3>
                <Button variant="ghost" size="sm" className="h-7 text-xs text-primary">
                    View Calendar <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
            </div>

            <div className="divide-y divide-border/20">
                {isLoading ? (
                    <div className="p-4"><LoadingState variant="list" rows={4} /></div>
                ) : todaySlots.length === 0 ? (
                    <div className="p-6">
                        <EmptyState
                            title="No appointments today"
                            description="Schedule will populate as patients book via AI or the widget."
                        />
                    </div>
                ) : (
                    todaySlots.map((slot: any, index: number) => (
                        <motion.div
                            key={slot.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: TIMING.STANDARD,
                                delay: index * TIMING.STAGGER,
                                ease: EASE_OUT_CUBIC,
                            }}
                            className="px-5 py-3 flex items-center gap-4 hover:bg-secondary/20 transition-colors group"
                        >
                            {/* Time */}
                            <div className="w-14 flex-shrink-0">
                                <span className="text-xs font-bold text-foreground tabular-nums">
                                    {slot.start_time?.substring(0, 5)}
                                </span>
                            </div>

                            {/* Patient & type */}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">
                                    {slot.patient_name || 'Walk-in'}
                                </p>
                                <p className="text-[10px] text-muted-foreground">{slot.appointment_type || 'General'}</p>
                            </div>

                            {/* Status tag */}
                            <span className={cn(
                                "text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border",
                                statusColors[slot.status] || statusColors.pending,
                            )}>
                                {slot.status}
                            </span>

                            {/* AI Badge — with subtle scale-in animation */}
                            {slot.booked_by_ai && (
                                <motion.span
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: TIMING.INSTANT, ease: EASE_OUT_CUBIC, delay: 0.2 }}
                                    className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md border border-primary/20"
                                >
                                    AI
                                </motion.span>
                            )}

                            {/* Quick actions (visible on hover) */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Confirm">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                </button>
                                <button className="p-1 rounded text-muted-foreground hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Reschedule">
                                    <RefreshCw className="h-3.5 w-3.5" />
                                </button>
                                <button className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors" title="Call">
                                    <Phone className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>
        </motion.div>
    );
}
