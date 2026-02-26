/**
 * ORADESK AI — APPOINTMENT DETAIL SLIDE PANEL
 *
 * Right-side panel on appointment click. Lazy loaded.
 * Shows: patient info, procedure, revenue, AI log, quick actions.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
    X, Phone, MessageSquare, Calendar, DollarSign, Clock,
    Bot, UserCheck, AlertTriangle, RefreshCw, ArrowRight,
    Shield, Activity, ChevronRight, Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { type CalendarAppointment } from '@/hooks/useSchedulingIntelligence';
import { CallPatientButton } from '@/components/patients/CallPatientButton';
import { EASE_OUT_CUBIC, TIMING } from '@/lib/animations';

// ─── Props ──────────────────────────────────────────────────

interface AppointmentDetailPanelProps {
    appointment: CalendarAppointment;
    onClose: () => void;
    onReschedule: () => void;
    onCancel: () => void;
    onConfirm: () => void;
    onConvertFollowUp: () => void;
    isUpdating: boolean;
}

export function AppointmentDetailPanel({
    appointment,
    onClose,
    onReschedule,
    onCancel,
    onConfirm,
    onConvertFollowUp,
    isUpdating,
}: AppointmentDetailPanelProps) {
    const apt = appointment;
    const patientName = apt.patient
        ? `${apt.patient.first_name} ${apt.patient.last_name}`
        : 'Unknown Patient';
    const initials = apt.patient
        ? `${apt.patient.first_name.charAt(0)}${apt.patient.last_name.charAt(0)}`.toUpperCase()
        : '??';

    const statusColors: Record<string, { text: string; bg: string; border: string }> = {
        confirmed: { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
        scheduled: { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
        rescheduled: { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
        completed: { text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
        missed: { text: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' },
        cancelled: { text: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' },
    };

    const sc = statusColors[apt.status] ?? statusColors.scheduled;
    const isHighRisk = apt.no_show_probability > 60;

    return (
        <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ duration: 0.22, ease: EASE_OUT_CUBIC }}
            className="fixed top-0 right-0 bottom-0 w-[400px] bg-card border-l border-border shadow-2xl z-40 flex flex-col"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Header */}
            <div className="px-5 py-4 border-b border-border/40 flex items-start justify-between gap-3 bg-secondary/20">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                        'h-11 w-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 border',
                        isHighRisk
                            ? 'bg-red-50 text-red-600 border-red-200'
                            : 'bg-primary/10 text-primary border-primary/20',
                    )}>
                        {initials}
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-bold text-foreground truncate">{patientName}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn(
                                'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border',
                                sc.text, sc.bg, sc.border,
                            )}>
                                {apt.status}
                            </span>
                            {apt.confirmation_source === 'ai' && (
                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded text-primary bg-primary/10 border border-primary/20">
                                    AI Confirmed
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors flex-shrink-0"
                >
                    <X className="h-4 w-4 text-muted-foreground" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">

                {/* High Risk Warning */}
                {isHighRisk && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-2.5">
                        <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-red-700">High No-Show Risk</p>
                            <p className="text-[11px] text-red-600 mt-0.5">
                                {apt.no_show_probability}% probability. Consider sending a confirmation reminder.
                            </p>
                        </div>
                    </div>
                )}

                {/* Procedure & Time */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl border border-border/60 bg-card">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Procedure</p>
                        <p className="text-sm font-bold text-foreground mt-1">{apt.procedure_name}</p>
                    </div>
                    <div className="p-3.5 rounded-xl border border-border/60 bg-card">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Scheduled</p>
                        <p className="text-sm font-bold text-foreground mt-1">
                            {format(parseISO(apt.scheduled_at), 'h:mm a')}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{apt.duration_minutes} min</p>
                    </div>
                </div>

                {/* Revenue */}
                <div className="p-3.5 rounded-xl border border-border/60 bg-card flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Estimated Value</p>
                        <p className="text-xl font-bold text-emerald-600 mt-1">
                            ${apt.estimated_value.toLocaleString()}
                        </p>
                    </div>
                    <div className="p-2 bg-emerald-50 rounded-lg">
                        <DollarSign className="h-5 w-5 text-emerald-600" />
                    </div>
                </div>

                {/* Patient Contact */}
                <div className="bg-secondary/50 rounded-xl p-4 space-y-2.5">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Patient Contact</h4>
                    {apt.patient && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="font-medium text-foreground">{apt.patient.phone}</span>
                            </div>
                            {apt.patient.email && (
                                <div className="flex items-center gap-2 text-sm">
                                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="font-medium text-foreground truncate">{apt.patient.email}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* No-Show Probability */}
                <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">No-Show Probability</h4>
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                                className={cn(
                                    'h-full rounded-full transition-all',
                                    apt.no_show_probability > 60 ? 'bg-red-500' :
                                        apt.no_show_probability > 30 ? 'bg-amber-500' : 'bg-emerald-500',
                                )}
                                style={{ width: `${apt.no_show_probability}%` }}
                            />
                        </div>
                        <span className={cn(
                            'text-sm font-bold tabular-nums',
                            apt.no_show_probability > 60 ? 'text-red-500' :
                                apt.no_show_probability > 30 ? 'text-amber-600' : 'text-emerald-600',
                        )}>
                            {apt.no_show_probability}%
                        </span>
                    </div>
                </div>

                {/* AI Interaction Log */}
                <div className="bg-secondary/50 rounded-xl p-4 space-y-2.5">
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Bot className="h-3.5 w-3.5 text-primary" />
                        AI Interaction Log
                    </h4>
                    {apt.ai_managed ? (
                        <div className="space-y-2">
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5">
                                <p className="text-[10px] font-bold text-blue-600 uppercase">Booking Confirmation</p>
                                <p className="text-xs text-blue-700 mt-0.5">AI called patient and confirmed appointment. No concerns raised.</p>
                                <p className="text-[10px] text-blue-500 mt-1">
                                    {apt.confirmed_at ? formatDistanceToNow(parseISO(apt.confirmed_at), { addSuffix: true }) : 'Recently'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">No AI interactions for this appointment.</p>
                    )}
                </div>

                {/* Notes */}
                {apt.notes && (
                    <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Notes</h4>
                        <p className="text-xs text-foreground leading-relaxed">{apt.notes}</p>
                    </div>
                )}
            </div>

            {/* Quick Actions Footer */}
            <div className="px-5 py-4 border-t border-border/40 bg-secondary/10 space-y-3">
                {/* Primary Actions */}
                <div className="grid grid-cols-2 gap-2">
                    {apt.status === 'scheduled' && (
                        <Button
                            onClick={onConfirm}
                            disabled={isUpdating}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold h-9 rounded-xl gap-1.5"
                            size="sm"
                        >
                            <UserCheck className="h-3.5 w-3.5" />
                            Confirm
                        </Button>
                    )}
                    <Button
                        onClick={onReschedule}
                        disabled={isUpdating}
                        variant="outline"
                        size="sm"
                        className="text-xs font-semibold h-9 rounded-xl gap-1.5"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Reschedule
                    </Button>
                    <Button
                        onClick={onCancel}
                        disabled={isUpdating}
                        variant="outline"
                        size="sm"
                        className="text-xs font-semibold h-9 rounded-xl text-red-500 border-red-200 hover:bg-red-50 gap-1.5"
                    >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                    </Button>
                </div>

                {/* Secondary Actions */}
                <div className="flex gap-2">
                    {apt.patient && (
                        <CallPatientButton
                            patientId={apt.patient.id}
                            patientName={patientName}
                            phoneNumber={apt.patient.phone}
                            callType="confirmation"
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 text-xs font-semibold rounded-xl gap-1.5"
                        />
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs font-semibold rounded-xl gap-1.5"
                    >
                        <Send className="h-3 w-3" />
                        Reminder
                    </Button>
                    <Button
                        onClick={onConvertFollowUp}
                        variant="outline"
                        size="sm"
                        className="flex-1 h-8 text-xs font-semibold rounded-xl gap-1.5"
                    >
                        <ArrowRight className="h-3 w-3" />
                        Follow-Up
                    </Button>
                </div>
            </div>
        </motion.div>
    );
}
