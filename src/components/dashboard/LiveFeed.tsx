import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, CalendarCheck, CheckCircle2, XCircle, CreditCard, PhoneIncoming, ShieldAlert, PhoneForwarded, AlertTriangle, AlertCircle, Activity } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useOraStore, generateMicroCopy, type LiveEvent, type LiveEventType } from '@/stores/oraStore';
import { useAnalyticsEvents } from '@/hooks/useAnalytics';
import { LoadingState } from '@/components/states/LoadingState';
import { EmptyState } from '@/components/states/EmptyState';
import { feedItemVariants } from '@/lib/animations';

const EVENT_CONFIG: Record<string, { icon: typeof Phone; color: string; bgColor: string }> = {
    booking_created: { icon: CalendarCheck, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    appointment_confirmed: { icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    booking_cancelled: { icon: XCircle, color: 'text-red-500', bgColor: 'bg-red-50' },
    payment_received: { icon: CreditCard, color: 'text-blue-500', bgColor: 'bg-blue-50' },
    call_completed: { icon: Phone, color: 'text-primary', bgColor: 'bg-primary/10' },
    call_started: { icon: PhoneIncoming, color: 'text-primary', bgColor: 'bg-primary/10' },
    ai_escalation: { icon: ShieldAlert, color: 'text-amber-600', bgColor: 'bg-amber-50' },
    missed_call_recovered: { icon: PhoneForwarded, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    pms_sync_failure: { icon: AlertTriangle, color: 'text-red-500', bgColor: 'bg-red-50' },
    emergency_hard_stop: { icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-50' },
};

export function LiveFeed() {
    const { liveEvents } = useOraStore();
    const currencyMode = useOraStore((s) => s.currencyMode);
    const { data: apiEvents, isLoading } = useAnalyticsEvents({ limit: 15, days: 1 });
    const [filterType, setFilterType] = useState<string | null>(null);

    // Merge store events + API events into unified feed, applying micro-copy
    const mergedEvents: LiveEvent[] = useMemo(() => {
        const fromApi: LiveEvent[] = (apiEvents || []).map((e: any) => ({
            id: e.id,
            type: e.event_type as LiveEventType,
            timestamp: e.created_at,
            clinicId: e.clinic_id,
            patientName: e.patient?.first_name || 'Unknown',
            message: generateMicroCopy(e.event_type as LiveEventType, {
                amount: e.revenue_impact || 0,
                time: e.appointment_time || '',
                duration_seconds: e.duration_seconds || 0,
            }, currencyMode),
            severity: e.event_type === 'escalation_created' ? 'critical' as const : 'info' as const,
            metadata: e,
        }));

        const all = [...liveEvents, ...fromApi];
        all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return all.slice(0, 30);
    }, [liveEvents, apiEvents, currencyMode]);

    const filtered = filterType ? mergedEvents.filter((e) => e.type === filterType) : mergedEvents;

    return (
        <div className="bg-card border border-border/60 rounded-xl flex flex-col h-full">
            <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Activity className="h-4 w-4 text-primary" />
                        <motion.div
                            className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-emerald-500 rounded-full"
                            animate={{ scale: [1, 1.15, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                        />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">Live Feed</h3>
                </div>
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Real-time</span>
            </div>

            {/* Mini filter row */}
            <div className="px-4 py-2 border-b border-border/20 flex gap-1 overflow-x-auto">
                {['All', 'Calls', 'Bookings', 'Alerts'].map((f) => {
                    const typeMap: Record<string, string | null> = { All: null, Calls: 'call_completed', Bookings: 'booking_created', Alerts: 'ai_escalation' };
                    const isActive = filterType === typeMap[f];
                    return (
                        <button
                            key={f}
                            onClick={() => setFilterType(typeMap[f])}
                            className={cn(
                                "px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors",
                                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                            )}
                        >
                            {f}
                        </button>
                    );
                })}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[400px]">
                {isLoading ? (
                    <div className="p-4"><LoadingState variant="list" rows={4} /></div>
                ) : filtered.length === 0 ? (
                    <div className="p-6">
                        <EmptyState
                            title="No activity yet"
                            description="Events will appear here as your AI handles calls and bookings."
                        />
                    </div>
                ) : (
                    <AnimatePresence initial={false}>
                        {filtered.map((event) => {
                            const cfg = EVENT_CONFIG[event.type] || EVENT_CONFIG.call_completed;
                            const Icon = cfg.icon;
                            return (
                                <motion.div
                                    key={event.id}
                                    variants={feedItemVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="exit"
                                    className="px-5 py-3 border-b border-border/20 last:border-0 flex gap-3 hover:bg-secondary/20 transition-colors cursor-default"
                                >
                                    <div className={cn("mt-0.5 p-1.5 rounded-lg flex-shrink-0", cfg.bgColor)}>
                                        <Icon className={cn("h-3 w-3", cfg.color)} />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-semibold text-foreground truncate">{event.message}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5">
                                            {format(new Date(event.timestamp), 'h:mm a')}
                                            {event.patientName && <> • {event.patientName}</>}
                                        </p>
                                    </div>
                                    {event.severity === 'critical' && (
                                        <motion.div
                                            animate={{ scale: [1, 1.15, 1] }}
                                            transition={{ repeat: Infinity, duration: 2 }}
                                            className="mt-1"
                                        >
                                            <div className="h-2 w-2 rounded-full bg-red-500" />
                                        </motion.div>
                                    )}
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
