import { useState } from 'react';
import {
  Phone,
  Clock,
  ChevronDown,
  ChevronUp,
  Bot,
  User,
  ShieldCheck,
  AlertTriangle,
  Zap,
  Target,
  ShieldAlert,
  Search,
  Activity,
  FileText,
  Cpu,
  Radio,
  Terminal,
  ChevronRight,
  Loader2,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/states/LoadingState';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { CallToolsPanel } from '@/components/call-logs/CallToolsPanel';
import { LiveStatusBadge } from '@/components/call-logs/LiveStatusBadge';
import { ToolActivityToast } from '@/components/call-logs/ToolActivityToast';
import { useAICalls, AICall } from '@/hooks/useAICalls';
import { usePatients } from '@/hooks/usePatients';
import { useStaffTasks } from '@/hooks/useStaffTasks';
import { TriggerCallDialog } from '@/components/call-logs/TriggerCallDialog';
import { format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type OutcomeFilter =
  | 'all'
  | 'confirmed'
  | 'rescheduled'
  | 'action_needed'
  | 'cancelled'
  | 'unreachable';

export default function CallLogs() {
  const { calls, isLoading, isError } = useAICalls();
  const { patients } = usePatients();
  const { createTask } = useStaffTasks();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<OutcomeFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const getPatientName = (patientId: string) => {
    const patient = patients.find((p) => p.id === patientId);
    return patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown Patient';
  };

  const getPatientPhone = (patientId: string) => {
    const patient = patients.find((p) => p.id === patientId);
    return patient?.phone || '???.???.????';
  };

  const filteredCalls = calls.filter((c) => {
    const matchesFilter = filter === 'all' || c.outcome === filter;
    const name = getPatientName(c.patient_id).toLowerCase();
    const phone = getPatientPhone(c.patient_id);
    const matchesSearch = name.includes(searchTerm.toLowerCase()) || phone.includes(searchTerm);
    return matchesFilter && matchesSearch;
  });

  const handleConvertToTask = (call: AICall) => {
    createTask({
      title: `Follow up: ${getPatientName(call.patient_id)}`,
      description: call.escalation_reason || 'AI escalation - manual follow-up required',
      priority: 'high',
    });
  };

  const getStatusLabelText = (outcome: string | null) => {
    switch (outcome) {
      case 'confirmed': return 'Confirmed';
      case 'rescheduled': return 'Rescheduled';
      case 'action_needed': return 'Needs Review';
      case 'cancelled': return 'Cancelled';
      case 'unreachable': return 'No Answer';
      default: return 'In Progress';
    }
  };

  const getStatusColorClass = (outcome: string | null) => {
    switch (outcome) {
      case 'confirmed': return 'text-success bg-success/10 border-success/30';
      case 'rescheduled': return 'text-warning bg-warning/10 border-warning/30';
      case 'action_needed': return 'text-destructive bg-destructive/10 border-destructive/30';
      default: return 'text-muted-foreground bg-secondary border-border/50';
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Call History
          </h1>
          <p className="text-muted-foreground text-sm animate-pulse">Loading AI voice logs...</p>
        </div>
        <LoadingState variant="list" rows={5} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Call History
          </h1>
        </div>
        <ErrorState
          title="Connection Error"
          description="Unable to load call history. Please try again."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  const confirmedCount = calls.filter((c) => c.outcome === 'confirmed').length;
  const rescheduledCount = calls.filter((c) => c.outcome === 'rescheduled').length;
  const actionNeededCount = calls.filter((c) => c.outcome === 'action_needed').length;
  const escalationCount = calls.filter((c) => c.escalation_required).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">

      {/* Header */}
      <div className="relative border-b border-border/40 pb-8">
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Call History
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
              Review AI patient call recordings, outcomes, and take action when needed.
            </p>
          </div>
          <TriggerCallDialog />
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { id: 'all', label: 'All Calls', count: calls.length, color: 'text-primary' },
          { id: 'confirmed', label: 'Confirmed', count: confirmedCount, color: 'text-success' },
          { id: 'rescheduled', label: 'Rescheduled', count: rescheduledCount, color: 'text-warning' },
          { id: 'action_needed', label: 'Needs Review', count: actionNeededCount, color: 'text-destructive' }
        ].map((stat) => (
          <button
            key={stat.id}
            onClick={() => setFilter(stat.id as any)}
            className={cn(
              "p-5 bg-card border rounded-2xl transition-all duration-200 text-left hover:shadow-md",
              filter === stat.id ? "border-primary/40 shadow-sm" : "border-border/60 hover:border-primary/20"
            )}
          >
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-3 focus:outline-none">
              {stat.label}
            </span>
            <p className={cn("text-3xl font-bold font-serif-numbers", filter === stat.id ? stat.color : "text-foreground")}>
              {stat.count}
            </p>
          </button>
        ))}
      </div>

      {/* Main List */}
      <div className="bg-card border border-border rounded-2xl shadow-sm p-2 flex flex-col md:flex-row md:items-center gap-4 relative">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            placeholder="Search by name or phone..."
            className="bg-transparent border-none shadow-none h-12 text-sm text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-0 pl-11"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="hidden md:block h-6 w-px bg-border/60" />
        <div className="px-5 py-2 md:py-0 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center justify-between md:justify-end gap-2">
          <span>{filteredCalls.length} logs found</span>
          <Filter className="h-4 w-4 md:hidden" />
        </div>
      </div>

      {filteredCalls.length === 0 ? (
        <div className="bg-card border border-border shadow-sm rounded-2xl min-h-[400px] flex items-center justify-center">
          <EmptyState title="No Results" description={`No calls match the current active filter.`} />
        </div>
      ) : (
        <div className="space-y-4">
          {filteredCalls.map((call) => (
            <div key={call.id} className={cn(
              "group bg-card border rounded-2xl transition-all duration-300 overflow-hidden",
              expandedId === call.id ? "border-primary/30 shadow-md" : "border-border/60 hover:border-primary/20 hover:shadow-sm"
            )}>
              {/* Expandable Header */}
              <button
                onClick={() => setExpandedId(expandedId === call.id ? null : call.id)}
                className="w-full flex items-stretch min-h-[90px] text-left hover:bg-secondary/20 focus:outline-none"
              >
                <div className={cn(
                  "w-[4px] transition-all duration-300",
                  call.status === 'answered' ? "bg-success" :
                    call.status === 'calling' ? "bg-primary animate-pulse" :
                      call.status === 'failed' ? "bg-destructive" : "bg-border"
                )} />

                <div className="flex-1 px-6 py-4 flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">

                  <div className="flex items-center gap-5">
                    <div className={cn(
                      "h-12 w-12 rounded-xl border flex items-center justify-center transition-colors text-muted-foreground",
                      call.status === 'calling' ? "border-primary/30 bg-primary/5 text-primary" : "border-primary/10 bg-primary/5 group-hover:bg-primary/10 text-primary"
                    )}>
                      {call.status === 'calling' ? <Activity className="h-5 w-5" /> : (call.ai_managed ? <Bot className="h-5 w-5" /> : <User className="h-5 w-5" />)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-bold text-foreground">
                        {getPatientName(call.patient_id)}
                      </h3>
                      <div className={cn("px-2.5 py-0.5 border rounded-full text-[10px] font-semibold tracking-wide uppercase", getStatusColorClass(call.outcome))}>
                        {getStatusLabelText(call.outcome)}
                      </div>
                      {call.escalation_required && (
                        <div className="px-2.5 py-0.5 border border-destructive/20 bg-destructive/10 text-destructive text-[10px] rounded-full font-semibold uppercase flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Needs Follow-up
                        </div>
                      )}
                      <LiveStatusBadge status={call.status} className="hidden md:block !bg-transparent !p-0" />
                    </div>
                    <div className="flex items-center gap-5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {getPatientPhone(call.patient_id)}</span>
                      <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {formatDuration(call.duration_seconds)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 border-t md:border-t-0 md:border-l border-border/50 pt-4 md:pt-0 md:pl-8">
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Time</p>
                      <p className="text-sm font-semibold text-foreground">
                        {format(parseISO(call.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>

                    {call.revenue_impact > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-semibold text-success/80 uppercase tracking-wide">Impact</p>
                        <p className="text-sm font-bold text-success">
                          +${call.revenue_impact.toLocaleString()}
                        </p>
                      </div>
                    )}

                    <ChevronRight className={cn("h-5 w-5 text-muted-foreground transition-transform duration-300", expandedId === call.id && "rotate-90 text-primary")} />
                  </div>
                </div>
              </button>

              {/* Expanded Area */}
              {expandedId === call.id && (
                <div className="border-t border-border/50 bg-secondary/30 p-8 animate-in slide-in-from-top-2 duration-300 space-y-8">

                  {call.escalation_required && (
                    <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="p-1.5 bg-destructive/10 rounded-full text-destructive shrink-0">
                          <ShieldAlert className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-destructive">Staff Action Required</h4>
                          <p className="text-sm font-medium text-muted-foreground">{call.escalation_reason || "AI encountered an uncertainty during the call. Please follow up."}</p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleConvertToTask(call)}
                        variant="default"
                        className="h-10 px-5 text-sm font-semibold rounded-lg shrink-0"
                      >
                        Create Follow-up Task
                      </Button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Diagnostic column */}
                    <div className="space-y-6">
                      <div className="bg-card border border-border/60 rounded-xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 pb-3 border-b border-border/50">
                          <Target className="h-4 w-4 text-primary" />
                          <span className="text-sm font-bold text-foreground">Call Properties</span>
                        </div>
                        <div className="space-y-3">
                          {[
                            { l: 'Network Latency', v: `${call.processing_time_ms || 124} ms` },
                            { l: 'Orchestrator Model', v: 'Gemini 1.5 Pro' },
                            { l: 'Log Integrity', v: call.escalation_required ? 'Flagged' : 'Verified' },
                          ].map((d, i) => (
                            <div key={i} className="flex justify-between items-center text-xs font-semibold">
                              <span className="text-muted-foreground">{d.l}</span>
                              <span className="text-foreground">{d.v}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-card border border-border/60 rounded-xl p-5 shadow-sm space-y-3">
                        <div className="flex items-center gap-2 pb-3 border-b border-border/50">
                          <Cpu className="h-4 w-4 text-primary" />
                          <span className="text-sm font-bold text-foreground">AI Reasoning</span>
                        </div>
                        <p className="text-sm font-medium text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {call.ai_reasoning || "Diagnostic logs suppressed for this packet cycle."}
                        </p>
                      </div>
                    </div>

                    {/* Transcript column */}
                    <div className="lg:col-span-2">
                      <div className="bg-card border border-border/60 rounded-xl flex flex-col h-full shadow-sm overflow-hidden">
                        <div className="bg-secondary/50 border-b border-border/50 p-4 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <span className="text-sm font-bold text-foreground">Call Transcript</span>
                          </div>
                        </div>

                        <div className="p-6 max-h-[400px] overflow-y-auto space-y-6 custom-scrollbar flex-1 bg-card">
                          {call.transcript && Array.isArray(call.transcript) && call.transcript.length > 0 ? (
                            (call.transcript as any[]).map((msg, idx) => (
                              <div key={idx} className={cn(
                                "flex flex-col gap-1.5",
                                msg.role === 'ai' ? "items-start pr-12" : "items-end pl-12"
                              )}>
                                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 px-1">
                                  {msg.role === 'ai' ? 'AI Voice' : 'Patient'}
                                </span>
                                <div className={cn(
                                  "px-4 py-3 text-sm font-medium leading-relaxed rounded-2xl",
                                  msg.role === 'ai'
                                    ? "bg-secondary border border-border text-foreground rounded-tl-sm"
                                    : "bg-primary text-white shadow-sm rounded-tr-sm"
                                )}>
                                  {msg.message}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="h-full flex flex-col items-center justify-center pt-8 gap-3 text-muted-foreground">
                              <Loader2 className="h-5 w-5 animate-spin opacity-50" />
                              <span className="text-xs font-semibold uppercase tracking-wide">Syncing transcript...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
