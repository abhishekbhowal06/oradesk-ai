import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TranscriptViewer } from './TranscriptViewer';
import { StaffTask, TaskStatus } from '@/hooks/useStaffTasks';
import { AICall } from '@/hooks/useAICalls';
import {
    Phone,
    MessageSquare,
    Calendar,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Clock,
    User,
    ShieldCheck,
    Ban
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TaskDetailSheetProps {
    task: StaffTask | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdateStatus: (id: string, status: TaskStatus) => void;
}

export function TaskDetailSheet({ task, isOpen, onClose, onUpdateStatus }: TaskDetailSheetProps) {
    const [activeTab, setActiveTab] = useState('transcript');

    // Fetch linked call details if available
    const { data: callDetails, isLoading: isCallLoading } = useQuery({
        queryKey: ['ai_call', task?.ai_call_id],
        queryFn: async () => {
            if (!task?.ai_call_id) return null;
            const { data, error } = await supabase
                .from('ai_calls')
                .select('*')
                .eq('id', task.ai_call_id)
                .single();

            if (error) throw error;

            // Fix JSON to TranscriptMessage[] cast
            const callData = data as any;
            return {
                ...callData,
                transcript: Array.isArray(callData.transcript) ? callData.transcript : []
            } as AICall;
        },
        enabled: !!task?.ai_call_id,
    });

    if (!task) return null;

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-full sm:max-w-xl md:max-w-2xl bg-background/95 backdrop-blur-xl border-l border-white/10 p-0 shadow-2xl">
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-6 border-b border-white/10 bg-card/50">
                        <div className="flex items-center justify-between mb-2">
                            <Badge
                                variant="outline"
                                className={cn(
                                    "uppercase tracking-widest text-[10px] py-1 px-2 border-primary/20 bg-primary/5 text-primary",
                                )}
                            >
                                Task ID: {task.id.substring(0, 8)}
                            </Badge>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground font-mono">
                                    {format(new Date(task.created_at), 'MMM d, HH:mm')}
                                </span>
                                <Badge
                                    className={cn(
                                        "capitalize",
                                        task.priority === 'urgent' && "bg-destructive text-destructive-foreground",
                                        task.priority === 'high' && "bg-warning text-warning-foreground",
                                        task.priority === 'medium' && "bg-info text-info-foreground",
                                    )}
                                >
                                    {task.priority} Priority
                                </Badge>
                            </div>
                        </div>

                        <SheetTitle className="text-2xl font-bold tracking-tight text-white mb-1">
                            {task.title}
                        </SheetTitle>
                        <SheetDescription className="text-muted-foreground flex items-center gap-2">
                            <User className="h-3 w-3" />
                            {task.patient ? `${task.patient.first_name} ${task.patient.last_name}` : 'Unknown Patient'}
                            {task.patient_id && <span className="text-[10px] text-muted-foreground/50 font-mono">({task.patient_id.substring(0, 6)})</span>}
                        </SheetDescription>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">

                        {/* Description Box */}
                        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                                <AlertTriangle className="h-3 w-3" /> Issue Detected
                            </h3>
                            <p className="text-sm text-foreground/90 leading-relaxed">
                                {task.description || "No description provided."}
                            </p>
                        </div>

                        {/* AI Insights (if available) */}
                        {callDetails && (
                            <Tabs defaultValue="transcript" className="w-full" onValueChange={setActiveTab}>
                                <TabsList className="grid w-full grid-cols-2 bg-white/5">
                                    <TabsTrigger value="transcript">Live Transcript</TabsTrigger>
                                    <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
                                </TabsList>

                                <TabsContent value="transcript" className="mt-4">
                                    <div className="h-[350px] bg-black/40 rounded-lg border border-white/10 relative overflow-hidden">
                                        {isCallLoading ? (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <span className="animate-pulse text-xs font-mono text-muted-foreground">DECRYPTING LOGS...</span>
                                            </div>
                                        ) : (
                                            <TranscriptViewer
                                                transcript={callDetails.transcript as any}
                                                className="h-full border-0 bg-transparent"
                                            />
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="analysis" className="mt-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-white/5 p-3 rounded border border-white/5">
                                            <p className="text-[10px] uppercase text-muted-foreground">Confidence Score</p>
                                            <p className="text-xl font-mono text-primary">{Math.round((callDetails.confidence_score || 0) * 100)}%</p>
                                        </div>
                                        <div className="bg-white/5 p-3 rounded border border-white/5">
                                            <p className="text-[10px] uppercase text-muted-foreground">Sentiment</p>
                                            <p className="text-xl font-mono text-white">Neutral</p>
                                        </div>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded border border-white/5">
                                        <p className="text-[10px] uppercase text-muted-foreground mb-2">Escalation Reason</p>
                                        <p className="text-sm font-mono text-destructive-foreground bg-destructive/10 p-2 rounded">
                                            {callDetails.escalation_reason || "AUTO-FLAGGED BY NEURAL ENGINE"}
                                        </p>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        )}

                        {/* Action Grid */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Manual Override Actions
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                <Button variant="outline" className="h-auto py-3 border-white/10 hover:bg-white/5 hover:border-primary/50 justify-start" onClick={() => window.open(`tel:${task.patient?.id || ''}`)}>
                                    <Phone className="h-4 w-4 mr-2 text-primary" />
                                    <div className="text-left">
                                        <p className="text-sm font-semibold">Call Patient</p>
                                        <p className="text-[10px] text-muted-foreground">Initiate VOIP bridge</p>
                                    </div>
                                </Button>
                                <Button variant="outline" className="h-auto py-3 border-white/10 hover:bg-white/5 hover:border-primary/50 justify-start">
                                    <MessageSquare className="h-4 w-4 mr-2 text-primary" />
                                    <div className="text-left">
                                        <p className="text-sm font-semibold">Send SMS</p>
                                        <p className="text-[10px] text-muted-foreground">Manual template</p>
                                    </div>
                                </Button>
                                <Button variant="outline" className="h-auto py-3 border-white/10 hover:bg-white/5 hover:border-primary/50 justify-start">
                                    <Calendar className="h-4 w-4 mr-2 text-primary" />
                                    <div className="text-left">
                                        <p className="text-sm font-semibold">Reschedule</p>
                                        <p className="text-[10px] text-muted-foreground">Open calendar grid</p>
                                    </div>
                                </Button>
                                <Button variant="outline" className="h-auto py-3 border-white/10 hover:bg-white/5 hover:border-destructive/50 justify-start">
                                    <Ban className="h-4 w-4 mr-2 text-destructive" />
                                    <div className="text-left">
                                        <p className="text-sm font-semibold">Block Number</p>
                                        <p className="text-[10px] text-muted-foreground">Mark as spam</p>
                                    </div>
                                </Button>
                            </div>
                        </div>

                    </div>

                    {/* Footer - Resolution Actions */}
                    <div className="p-6 border-t border-white/10 bg-card/50 grid grid-cols-2 gap-4">
                        <Button
                            variant="default"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] border-0"
                            onClick={() => {
                                onUpdateStatus(task.id, 'completed');
                                onClose();
                            }}
                        >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Mark Resolved
                        </Button>

                        {task.status !== 'cancelled' && (
                            <Button
                                variant="destructive"
                                className="bg-white/5 hover:bg-destructive/20 text-destructive border border-destructive/20 hover:border-destructive"
                                onClick={() => {
                                    onUpdateStatus(task.id, 'cancelled');
                                    onClose();
                                }}
                            >
                                <XCircle className="mr-2 h-4 w-4" />
                                Dismiss / False Alarm
                            </Button>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
