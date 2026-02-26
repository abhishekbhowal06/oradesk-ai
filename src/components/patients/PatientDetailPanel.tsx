/**
 * ORADESK AI — PATIENT DETAIL SLIDE PANEL
 *
 * Right-side slide panel appearing on patient row click.
 * Lazy-loaded. Contains:
 *   - Patient header with avatar + quick actions
 *   - Tabbed content: Overview | Timeline | Follow-Ups | AI Log
 *   - Follow-up timeline with status tracking
 *   - AI result summary with doctor approval buttons
 *   - Revenue opportunity suggestions
 */

import { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Phone, MessageSquare, Calendar, Plus, DollarSign, Clock,
    Bot, UserCheck, CheckCircle2, XCircle, AlertTriangle,
    ChevronRight, Activity, Shield, CreditCard, Stethoscope,
    ClipboardList, RefreshCw, ExternalLink, ArrowUpRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { format, formatDistanceToNow, isPast, parseISO } from 'date-fns';
import {
    type PatientIntelligence,
    type FollowUpTask,
    type FollowUpType,
    useFollowUpTasks,
} from '@/hooks/usePatientIntelligence';
import { AddFollowUpModal } from './AddFollowUpModal';
import { CallPatientButton } from './CallPatientButton';
import { EASE_OUT_CUBIC, TIMING } from '@/lib/animations';

// ─── Follow-Up Type Config ──────────────────────────────────

const FU_TYPE_CONFIG: Record<FollowUpType, { icon: typeof Stethoscope; label: string; color: string; bgColor: string }> = {
    post_treatment: { icon: Stethoscope, label: 'Post-Treatment', color: 'text-primary', bgColor: 'bg-primary/10' },
    treatment_plan_review: { icon: ClipboardList, label: 'Plan Review', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    recall_reactivation: { icon: RefreshCw, label: 'Recall', color: 'text-amber-600', bgColor: 'bg-amber-50' },
    payment_follow_up: { icon: CreditCard, label: 'Payment', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    lab_results: { icon: Activity, label: 'Lab Results', color: 'text-purple-600', bgColor: 'bg-purple-50' },
    custom: { icon: ClipboardList, label: 'Custom', color: 'text-gray-600', bgColor: 'bg-gray-50' },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
    scheduled: { label: 'Scheduled', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    queued: { label: 'Queued', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    in_progress: { label: 'In Progress', color: 'text-amber-600', bgColor: 'bg-amber-50' },
    awaiting_approval: { label: 'Needs Approval', color: 'text-primary', bgColor: 'bg-primary/10' },
    approved: { label: 'Approved', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    completed: { label: 'Completed', color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    failed: { label: 'Failed', color: 'text-red-500', bgColor: 'bg-red-50' },
    cancelled: { label: 'Cancelled', color: 'text-gray-500', bgColor: 'bg-gray-50' },
};

// ─── Component ──────────────────────────────────────────────

interface PatientDetailPanelProps {
    patient: PatientIntelligence;
    onClose: () => void;
}

type TabId = 'overview' | 'timeline' | 'followups' | 'ai_log';

export function PatientDetailPanel({ patient, onClose }: PatientDetailPanelProps) {
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [showFollowUpModal, setShowFollowUpModal] = useState(false);
    const { followUps, approveFollowUp, completeFollowUp } = useFollowUpTasks(patient.id);

    const fullName = `${patient.first_name} ${patient.last_name}`;
    const initials = `${patient.first_name.charAt(0)}${patient.last_name.charAt(0)}`.toUpperCase();

    const tabs: Array<{ id: TabId; label: string; count?: number }> = [
        { id: 'overview', label: 'Overview' },
        { id: 'timeline', label: 'Timeline' },
        { id: 'followups', label: 'Follow-Ups', count: followUps.filter((f) => f.status !== 'completed' && f.status !== 'cancelled').length },
        { id: 'ai_log', label: 'AI Log' },
    ];

    const riskColors: Record<string, string> = {
        low: 'text-emerald-600 bg-emerald-50 border-emerald-200',
        medium: 'text-amber-600 bg-amber-50 border-amber-200',
        high: 'text-red-500 bg-red-50 border-red-200',
    };

    return (
        <>
            <motion.div
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ duration: TIMING.EMPHASIS, ease: EASE_OUT_CUBIC }}
                className="fixed top-0 right-0 bottom-0 w-[420px] bg-card border-l border-border shadow-2xl z-40 flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Header ─────────────────────────────────────── */}
                <div className="px-5 py-4 border-b border-border/40 flex items-start justify-between gap-3 bg-secondary/20">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-bold text-foreground truncate">{fullName}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={cn(
                                    'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border',
                                    patient.status === 'active' ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
                                        patient.status === 'inactive' ? 'text-amber-600 bg-amber-50 border-amber-200' :
                                            'text-red-500 bg-red-50 border-red-200',
                                )}>
                                    {patient.status}
                                </span>
                                <span className={cn(
                                    'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border',
                                    riskColors[patient.risk_level],
                                )}>
                                    {patient.risk_level} risk
                                </span>
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

                {/* ── Quick Actions ──────────────────────────────── */}
                <div className="px-5 py-3 border-b border-border/30 flex gap-2">
                    <Button
                        onClick={() => setShowFollowUpModal(true)}
                        className="flex-1 h-9 text-xs font-semibold bg-primary text-white hover:bg-primary/90 rounded-xl gap-1.5"
                        size="sm"
                    >
                        <Plus className="h-3.5 w-3.5" />
                        Add Follow-Up
                    </Button>
                    <div className="flex gap-1.5">
                        <CallPatientButton
                            patientId={patient.id}
                            patientName={fullName}
                            phoneNumber={patient.phone}
                            callType="confirmation"
                            variant="outline"
                            size="icon"
                        />
                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl">
                            <MessageSquare className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl">
                            <Calendar className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                </div>

                {/* ── Tabs ───────────────────────────────────────── */}
                <div className="px-5 border-b border-border/30 flex gap-0.5">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                'px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors relative',
                                activeTab === tab.id
                                    ? 'text-primary border-primary'
                                    : 'text-muted-foreground border-transparent hover:text-foreground',
                            )}
                        >
                            {tab.label}
                            {tab.count !== undefined && tab.count > 0 && (
                                <span className="ml-1 bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                    {tab.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {/* ── Content ────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.15, ease: EASE_OUT_CUBIC }}
                            className="p-5 space-y-4"
                        >
                            {activeTab === 'overview' && <OverviewTab patient={patient} />}
                            {activeTab === 'timeline' && <TimelineTab patient={patient} />}
                            {activeTab === 'followups' && (
                                <FollowUpsTab
                                    followUps={followUps}
                                    onApprove={(id) => approveFollowUp({ id })}
                                    onComplete={(id) => completeFollowUp({ id })}
                                />
                            )}
                            {activeTab === 'ai_log' && <AILogTab patient={patient} />}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* Follow-Up Modal */}
            <AddFollowUpModal
                open={showFollowUpModal}
                onClose={() => setShowFollowUpModal(false)}
                patientId={patient.id}
                patientName={fullName}
            />
        </>
    );
}

// ─── Overview Tab ───────────────────────────────────────────

function OverviewTab({ patient }: { patient: PatientIntelligence }) {
    return (
        <div className="space-y-4">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-3">
                <MetricCard
                    label="Lifetime Value"
                    value={`$${patient.lifetime_value.toLocaleString()}`}
                    icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
                    valueColor="text-emerald-600"
                    bgColor="bg-emerald-50"
                />
                <MetricCard
                    label="Outstanding Balance"
                    value={patient.outstanding_balance > 0 ? `$${patient.outstanding_balance.toLocaleString()}` : '$0'}
                    icon={<CreditCard className="h-4 w-4 text-amber-600" />}
                    valueColor={patient.outstanding_balance > 0 ? 'text-amber-600' : 'text-muted-foreground'}
                    bgColor="bg-amber-50"
                />
            </div>

            {/* Contact Info */}
            <div className="bg-secondary/50 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Contact</h4>
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-foreground font-medium">{patient.phone}</span>
                    </div>
                    {patient.email && (
                        <div className="flex items-center gap-2 text-sm">
                            <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-foreground font-medium truncate">{patient.email}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Last Visit: </span>
                        <span className="text-foreground font-medium">
                            {patient.last_visit ? format(parseISO(patient.last_visit), 'MMM d, yyyy') : 'Never'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Next Appointment */}
            {patient.next_appointment_date && (
                <div className="bg-primary/5 border border-primary/15 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase">Next Appointment</p>
                            <p className="text-sm font-bold text-foreground mt-1">
                                {format(parseISO(patient.next_appointment_date), 'MMM d, yyyy • h:mm a')}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">{patient.next_appointment_type}</p>
                        </div>
                        <Calendar className="h-5 w-5 text-primary" />
                    </div>
                </div>
            )}

            {/* AI Engagement */}
            <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">AI Engagement Score</h4>
                <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                            className={cn(
                                'h-full rounded-full transition-all duration-500',
                                patient.ai_engagement_score >= 80 ? 'bg-emerald-500' :
                                    patient.ai_engagement_score >= 50 ? 'bg-amber-500' : 'bg-red-500',
                            )}
                            style={{ width: `${patient.ai_engagement_score}%` }}
                        />
                    </div>
                    <span className="text-sm font-bold text-foreground tabular-nums w-10 text-right">
                        {patient.ai_engagement_score}%
                    </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                    {patient.total_ai_calls} calls • {patient.successful_ai_calls} successful
                </p>
            </div>

            {/* Appointment Stats */}
            <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Appointment History</h4>
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                        <p className="text-lg font-bold text-foreground">{patient.total_appointments}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                    </div>
                    <div>
                        <p className="text-lg font-bold text-emerald-600">{patient.completed_appointments}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Completed</p>
                    </div>
                    <div>
                        <p className="text-lg font-bold text-red-500">{patient.missed_appointments}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">Missed</p>
                    </div>
                </div>
            </div>

            {/* Revenue Opportunity */}
            {patient.outstanding_balance > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs font-bold text-amber-800">Revenue Opportunity</p>
                        <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                            ${patient.outstanding_balance.toLocaleString()} outstanding balance.
                            Schedule a payment follow-up to secure this revenue.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

function MetricCard({ label, value, icon, valueColor, bgColor }: {
    label: string; value: string; icon: React.ReactNode; valueColor: string; bgColor: string;
}) {
    return (
        <div className="p-3.5 rounded-xl border border-border/60 bg-card space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
                <div className={cn('p-1 rounded-lg', bgColor)}>{icon}</div>
            </div>
            <p className={cn('text-xl font-bold', valueColor)}>{value}</p>
        </div>
    );
}

// ─── Timeline Tab ───────────────────────────────────────────

function TimelineTab({ patient }: { patient: PatientIntelligence }) {
    // Mock timeline events
    const events = [
        { type: 'appointment' as const, date: new Date(), label: 'Next: Cleaning', status: 'upcoming' },
        { type: 'ai_call' as const, date: new Date(Date.now() - 86400000 * 2), label: 'AI Confirmation Call', status: 'completed' },
        { type: 'followup' as const, date: new Date(Date.now() - 86400000 * 5), label: 'Post-Treatment Check', status: 'completed' },
        { type: 'appointment' as const, date: new Date(Date.now() - 86400000 * 14), label: 'Root Canal', status: 'completed' },
        { type: 'ai_call' as const, date: new Date(Date.now() - 86400000 * 15), label: 'Booking Confirmation', status: 'completed' },
        { type: 'followup' as const, date: new Date(Date.now() - 86400000 * 30), label: 'Recall Outreach', status: 'completed' },
    ];

    const iconMap = {
        appointment: Calendar,
        ai_call: Bot,
        followup: Stethoscope,
    };

    const colorMap = {
        appointment: 'bg-primary/10 text-primary border-primary/20',
        ai_call: 'bg-blue-50 text-blue-600 border-blue-200',
        followup: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    };

    return (
        <div className="space-y-1">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Patient Timeline</h4>
            {events.map((event, i) => {
                const Icon = iconMap[event.type];
                return (
                    <div key={i} className="flex gap-3 relative">
                        {/* Connector line */}
                        {i < events.length - 1 && (
                            <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border/50" />
                        )}
                        <div className={cn('h-8 w-8 rounded-lg border flex items-center justify-center flex-shrink-0', colorMap[event.type])}>
                            <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="pb-4 min-w-0 flex-1">
                            <p className="text-xs font-semibold text-foreground">{event.label}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                                {formatDistanceToNow(event.date, { addSuffix: true })}
                            </p>
                        </div>
                        <span className={cn(
                            'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded h-fit',
                            event.status === 'completed' ? 'text-emerald-600 bg-emerald-50' : 'text-primary bg-primary/10',
                        )}>
                            {event.status}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Follow-Ups Tab ─────────────────────────────────────────

function FollowUpsTab({ followUps, onApprove, onComplete }: {
    followUps: FollowUpTask[];
    onApprove: (id: string) => void;
    onComplete: (id: string) => void;
}) {
    if (followUps.length === 0) {
        return (
            <div className="text-center py-8">
                <ClipboardList className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm font-semibold text-muted-foreground">No follow-ups yet</p>
                <p className="text-xs text-muted-foreground/70 mt-0.5">Use "Add Follow-Up" to schedule one.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Follow-Up Tasks</h4>
            {followUps.map((fu) => {
                const typeConfig = FU_TYPE_CONFIG[fu.follow_up_type] || FU_TYPE_CONFIG.custom;
                const statusConfig = STATUS_CONFIG[fu.status] || STATUS_CONFIG.scheduled;
                const Icon = typeConfig.icon;
                const isOverdue = fu.status !== 'completed' && fu.status !== 'cancelled' && isPast(parseISO(fu.due_date));
                const needsApproval = fu.status === 'awaiting_approval';

                return (
                    <motion.div
                        key={fu.id}
                        layout
                        className={cn(
                            'rounded-xl border p-4 space-y-3 transition-all',
                            isOverdue ? 'border-red-200 bg-red-50/30' : 'border-border/60',
                            needsApproval && 'border-primary/30 bg-primary/5',
                        )}
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className={cn('p-1.5 rounded-lg', typeConfig.bgColor)}>
                                    <Icon className={cn('h-3.5 w-3.5', typeConfig.color)} />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-foreground">{typeConfig.label}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        Due: {format(parseISO(fu.due_date), 'MMM d, yyyy')}
                                        {isOverdue && <span className="text-red-500 font-bold ml-1">OVERDUE</span>}
                                    </p>
                                </div>
                            </div>
                            <span className={cn(
                                'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
                                statusConfig.color, statusConfig.bgColor,
                            )}>
                                {statusConfig.label}
                            </span>
                        </div>

                        {/* Mode + Priority */}
                        <div className="flex gap-2">
                            <span className={cn(
                                'text-[10px] font-semibold px-2 py-0.5 rounded-md border',
                                fu.execution_mode === 'ai_automated'
                                    ? 'text-blue-600 bg-blue-50 border-blue-200'
                                    : 'text-gray-600 bg-gray-50 border-gray-200',
                            )}>
                                {fu.execution_mode === 'ai_automated' ? '🤖 AI' : '👤 Staff'}
                            </span>
                            <span className={cn(
                                'text-[10px] font-semibold px-2 py-0.5 rounded-md border',
                                fu.priority === 'urgent' ? 'text-red-600 bg-red-50 border-red-200' :
                                    fu.priority === 'high' ? 'text-amber-600 bg-amber-50 border-amber-200' :
                                        'text-gray-500 bg-gray-50 border-gray-200',
                            )}>
                                {fu.priority}
                            </span>
                        </div>

                        {/* Doctor Instructions */}
                        {fu.doctor_instructions && (
                            <div className="bg-secondary/50 rounded-lg p-2.5">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Instructions</p>
                                <p className="text-xs text-foreground leading-relaxed">{fu.doctor_instructions}</p>
                            </div>
                        )}

                        {/* AI Result Summary */}
                        {fu.ai_result_summary && (
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5">
                                <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <Bot className="h-3 w-3" /> AI Result
                                </p>
                                <p className="text-xs text-blue-800 leading-relaxed">{fu.ai_result_summary}</p>
                                {fu.ai_executed_at && (
                                    <p className="text-[10px] text-blue-500 mt-1">
                                        Executed {formatDistanceToNow(parseISO(fu.ai_executed_at), { addSuffix: true })}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Doctor Approval Buttons */}
                        {needsApproval && (
                            <div className="flex gap-2 pt-1">
                                <Button
                                    size="sm"
                                    className="flex-1 h-8 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1"
                                    onClick={() => onApprove(fu.id)}
                                >
                                    <CheckCircle2 className="h-3 w-3" />
                                    Approve Result
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-[11px] font-semibold rounded-lg gap-1"
                                >
                                    <XCircle className="h-3 w-3" />
                                    Reject
                                </Button>
                            </div>
                        )}

                        {/* Complete Button */}
                        {fu.status === 'approved' && (
                            <Button
                                size="sm"
                                className="w-full h-8 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg gap-1"
                                onClick={() => onComplete(fu.id)}
                            >
                                <CheckCircle2 className="h-3 w-3" />
                                Mark Complete
                            </Button>
                        )}
                    </motion.div>
                );
            })}
        </div>
    );
}

// ─── AI Log Tab ─────────────────────────────────────────────

function AILogTab({ patient }: { patient: PatientIntelligence }) {
    const logs = [
        { time: new Date(Date.now() - 7200000), type: 'Confirmation Call', status: 'success', duration: '2m 14s', summary: 'Patient confirmed appointment. No concerns raised.' },
        { time: new Date(Date.now() - 86400000 * 3), type: 'Recall Outreach', status: 'success', duration: '3m 01s', summary: 'Patient interested in scheduling cleaning. Booked for next week.' },
        { time: new Date(Date.now() - 86400000 * 10), type: 'Post-Op Follow-Up', status: 'escalated', duration: '1m 45s', summary: 'Patient reported mild discomfort. Escalated to doctor for review.' },
        { time: new Date(Date.now() - 86400000 * 15), type: 'Payment Reminder', status: 'success', duration: '1m 22s', summary: 'Patient agreed to pay outstanding balance of $350 by end of week.' },
    ];

    return (
        <div className="space-y-3">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">AI Interaction History</h4>
            {patient.total_ai_calls === 0 ? (
                <div className="text-center py-8">
                    <Bot className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-muted-foreground">No AI interactions yet</p>
                </div>
            ) : (
                logs.map((log, i) => (
                    <div key={i} className="border border-border/60 rounded-xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-foreground">{log.type}</p>
                            <span className={cn(
                                'text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
                                log.status === 'success' ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50',
                            )}>
                                {log.status}
                            </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{log.summary}</p>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span>{format(log.time, 'MMM d, h:mm a')}</span>
                            <span>•</span>
                            <span>Duration: {log.duration}</span>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
