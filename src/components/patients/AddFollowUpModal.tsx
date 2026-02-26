/**
 * ORADESK AI — ADD FOLLOW-UP MODAL
 *
 * Doctor-facing modal for scheduling follow-up tasks directly from patient profile.
 * Syncs into: Follow-Up Queue → Outbound Call Queue → AI Agent → Campaign Dashboard
 *
 * Sections:
 *   1. Follow-up type selector (2×2 grid)
 *   2. Execution mode (AI / Staff toggle)
 *   3. Due date with quick-select chips
 *   4. Doctor's instruction notes
 *   5. Priority selector (Normal / High / Urgent)
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Stethoscope, ClipboardList, RefreshCw, CreditCard,
    Bot, UserCheck, Calendar, Clock, X, AlertTriangle,
    FileText, Beaker,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    useFollowUpTasks,
    type FollowUpType,
    type FollowUpExecutionMode,
    type FollowUpPriority,
    type CreateFollowUpTaskInput,
} from '@/hooks/usePatientIntelligence';

// ─── Follow-Up Type Config ──────────────────────────────────

const FOLLOW_UP_TYPES: Array<{
    id: FollowUpType;
    label: string;
    description: string;
    icon: typeof Stethoscope;
    color: string;
    bgColor: string;
}> = [
        {
            id: 'post_treatment',
            label: 'Post-Treatment Check',
            description: 'Verify healing & recovery',
            icon: Stethoscope,
            color: 'text-primary',
            bgColor: 'bg-primary/10',
        },
        {
            id: 'treatment_plan_review',
            label: 'Treatment Plan Review',
            description: 'Discuss next treatment steps',
            icon: ClipboardList,
            color: 'text-blue-600',
            bgColor: 'bg-blue-50',
        },
        {
            id: 'recall_reactivation',
            label: 'Recall / Reactivation',
            description: 'Re-engage inactive patient',
            icon: RefreshCw,
            color: 'text-amber-600',
            bgColor: 'bg-amber-50',
        },
        {
            id: 'payment_follow_up',
            label: 'Payment Follow-Up',
            description: 'Outstanding balance outreach',
            icon: CreditCard,
            color: 'text-emerald-600',
            bgColor: 'bg-emerald-50',
        },
    ];

// ─── Quick Date Chips ───────────────────────────────────────

function getQuickDate(label: string): string {
    const d = new Date();
    switch (label) {
        case 'Today':
            return d.toISOString().split('T')[0];
        case 'Tomorrow':
            d.setDate(d.getDate() + 1);
            return d.toISOString().split('T')[0];
        case '3 Days':
            d.setDate(d.getDate() + 3);
            return d.toISOString().split('T')[0];
        case '1 Week':
            d.setDate(d.getDate() + 7);
            return d.toISOString().split('T')[0];
        case '2 Weeks':
            d.setDate(d.getDate() + 14);
            return d.toISOString().split('T')[0];
        default:
            return d.toISOString().split('T')[0];
    }
}

// ─── Component ──────────────────────────────────────────────

interface AddFollowUpModalProps {
    open: boolean;
    onClose: () => void;
    patientId: string;
    patientName: string;
}

export function AddFollowUpModal({
    open,
    onClose,
    patientId,
    patientName,
}: AddFollowUpModalProps) {
    const { createFollowUp, isCreating } = useFollowUpTasks(patientId);

    // Form state
    const [type, setType] = useState<FollowUpType>('post_treatment');
    const [mode, setMode] = useState<FollowUpExecutionMode>('ai_automated');
    const [priority, setPriority] = useState<FollowUpPriority>('normal');
    const [dueDate, setDueDate] = useState(getQuickDate('Tomorrow'));
    const [activeChip, setActiveChip] = useState('Tomorrow');
    const [instructions, setInstructions] = useState('');

    const handleSubmit = useCallback(() => {
        const input: CreateFollowUpTaskInput = {
            patient_id: patientId,
            follow_up_type: type,
            execution_mode: mode,
            priority,
            due_date: dueDate,
            doctor_instructions: instructions || undefined,
        };

        createFollowUp(input, {
            onSuccess: () => {
                // Reset form
                setType('post_treatment');
                setMode('ai_automated');
                setPriority('normal');
                setDueDate(getQuickDate('Tomorrow'));
                setActiveChip('Tomorrow');
                setInstructions('');
                onClose();
            },
        });
    }, [patientId, type, mode, priority, dueDate, instructions, createFollowUp, onClose]);

    const handleQuickDate = (label: string) => {
        setActiveChip(label);
        setDueDate(getQuickDate(label));
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="bg-card border border-border rounded-2xl p-0 overflow-hidden sm:max-w-lg shadow-lg">
                <DialogTitle className="sr-only">Schedule Follow-Up</DialogTitle>

                {/* Header */}
                <div className="bg-secondary/50 border-b border-border/50 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-9 w-9 bg-primary/10 rounded-xl flex items-center justify-center">
                            <Calendar className="h-4.5 w-4.5 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-foreground">Schedule Follow-Up</h3>
                            <p className="text-xs text-muted-foreground">for {patientName}</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">

                    {/* 1. Follow-Up Type */}
                    <div className="space-y-2.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Follow-Up Type
                        </label>
                        <div className="grid grid-cols-2 gap-2.5">
                            {FOLLOW_UP_TYPES.map((ft) => {
                                const isSelected = type === ft.id;
                                const Icon = ft.icon;
                                return (
                                    <button
                                        key={ft.id}
                                        onClick={() => setType(ft.id)}
                                        className={cn(
                                            'flex items-start gap-3 p-3.5 rounded-xl border transition-all duration-150 text-left',
                                            isSelected
                                                ? 'border-primary/40 bg-primary/5 shadow-sm'
                                                : 'border-border hover:border-primary/20 hover:bg-secondary/30',
                                        )}
                                    >
                                        <div className={cn('p-1.5 rounded-lg flex-shrink-0', ft.bgColor)}>
                                            <Icon className={cn('h-4 w-4', ft.color)} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className={cn(
                                                'text-xs font-semibold',
                                                isSelected ? 'text-primary' : 'text-foreground',
                                            )}>
                                                {ft.label}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                                                {ft.description}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 2. Execution Mode */}
                    <div className="space-y-2.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Execution Mode
                        </label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setMode('ai_automated')}
                                className={cn(
                                    'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-150 text-xs font-semibold',
                                    mode === 'ai_automated'
                                        ? 'bg-primary text-white border-primary shadow-sm'
                                        : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/20',
                                )}
                            >
                                <Bot className="h-4 w-4" />
                                AI Automated
                            </button>
                            <button
                                onClick={() => setMode('staff_manual')}
                                className={cn(
                                    'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-150 text-xs font-semibold',
                                    mode === 'staff_manual'
                                        ? 'bg-primary text-white border-primary shadow-sm'
                                        : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/20',
                                )}
                            >
                                <UserCheck className="h-4 w-4" />
                                Staff Manual
                            </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                            {mode === 'ai_automated'
                                ? 'AI will call the patient and report back for your approval before closing.'
                                : 'Task will appear in staff queue for manual execution.'}
                        </p>
                    </div>

                    {/* 3. Due Date */}
                    <div className="space-y-2.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Follow-Up Due Date
                        </label>
                        <input
                            type="date"
                            value={dueDate}
                            onChange={(e) => {
                                setDueDate(e.target.value);
                                setActiveChip('');
                            }}
                            className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                        <div className="flex gap-1.5 flex-wrap">
                            {['Today', 'Tomorrow', '3 Days', '1 Week', '2 Weeks'].map((label) => (
                                <button
                                    key={label}
                                    onClick={() => handleQuickDate(label)}
                                    className={cn(
                                        'px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-colors',
                                        activeChip === label
                                            ? 'bg-primary/10 text-primary border-primary/20'
                                            : 'bg-secondary text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/80',
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 4. Instructions */}
                    <div className="space-y-2.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Doctor's Instructions
                        </label>
                        <div className="relative">
                            <textarea
                                value={instructions}
                                onChange={(e) => setInstructions(e.target.value.slice(0, 500))}
                                placeholder="e.g., Check healing progress after extraction. Ask about pain levels."
                                rows={3}
                                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                            />
                            <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/50">
                                {instructions.length}/500
                            </span>
                        </div>
                    </div>

                    {/* 5. Priority */}
                    <div className="space-y-2.5">
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Priority
                        </label>
                        <div className="flex gap-2">
                            {([
                                { id: 'normal' as const, label: 'Normal', color: 'text-muted-foreground', bg: 'bg-secondary', activeBg: 'bg-secondary', activeBorder: 'border-border' },
                                { id: 'high' as const, label: 'High', color: 'text-amber-600', bg: 'bg-amber-50', activeBg: 'bg-amber-50', activeBorder: 'border-amber-300' },
                                { id: 'urgent' as const, label: 'Urgent', color: 'text-red-600', bg: 'bg-red-50', activeBg: 'bg-red-50', activeBorder: 'border-red-300' },
                            ]).map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => setPriority(p.id)}
                                    className={cn(
                                        'flex-1 px-3 py-2 rounded-xl border text-xs font-semibold transition-all duration-150',
                                        priority === p.id
                                            ? `${p.activeBg} ${p.color} ${p.activeBorder} shadow-sm`
                                            : 'bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary',
                                    )}
                                >
                                    {p.id === 'urgent' && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border/50 flex gap-3 bg-secondary/20">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 rounded-xl h-10 text-sm font-semibold"
                        disabled={isCreating}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isCreating}
                        className="flex-1 bg-primary text-white hover:bg-primary/90 rounded-xl h-10 text-sm font-semibold"
                    >
                        {isCreating ? 'Scheduling...' : 'Schedule Follow-Up'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
