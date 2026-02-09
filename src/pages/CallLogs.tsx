import { useState } from 'react';
import { Phone, Clock, ChevronDown, ChevronUp, Bot, User, ShieldCheck, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/states/LoadingState';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { EscalationFlag } from '@/components/ui/EscalationFlag';
import { CallToolsPanel } from '@/components/call-logs/CallToolsPanel';
import { useAICalls, AICall } from '@/hooks/useAICalls';
import { usePatients } from '@/hooks/usePatients';
import { useStaffTasks } from '@/hooks/useStaffTasks';
import { format, parseISO } from 'date-fns';

type OutcomeFilter = 'all' | 'confirmed' | 'rescheduled' | 'action_needed' | 'cancelled' | 'unreachable';

export default function CallLogs() {
  const { calls, isLoading, isError } = useAICalls();
  const { patients } = usePatients();
  const { createTask } = useStaffTasks();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<OutcomeFilter>('all');

  const getPatientName = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    return patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown Patient';
  };

  const getPatientPhone = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    return patient?.phone || 'Unknown';
  };

  const filteredCalls = filter === 'all'
    ? calls
    : calls.filter(c => c.outcome === filter);

  const handleConvertToTask = (call: AICall) => {
    createTask({
      title: `Follow up: ${getPatientName(call.patient_id)}`,
      description: call.escalation_reason || 'AI escalation - manual follow-up required',
      priority: 'high',
    });
  };

  const getStatusBadge = (outcome: string | null) => {
    switch (outcome) {
      case 'confirmed':
        return <span className="badge-confirmed">Confirmed</span>;
      case 'rescheduled':
        return <span className="badge-rescheduled">Rescheduled</span>;
      case 'action_needed':
        return <span className="badge-action">Action Required</span>;
      case 'cancelled':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/20 text-destructive">Cancelled</span>;
      case 'unreachable':
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">Unreachable</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">Pending</span>;
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
            AI Conversation Logs
          </h1>
          <p className="text-muted-foreground mt-1">
            Loading patient interaction records...
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <LoadingState variant="card" />
          <LoadingState variant="card" />
          <LoadingState variant="card" />
          <LoadingState variant="card" />
        </div>
        <LoadingState variant="list" rows={4} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
            AI Conversation Logs
          </h1>
        </div>
        <ErrorState
          title="Failed to Load Call Logs"
          description="Unable to retrieve AI conversation records. Please check your connection and try again."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  const confirmedCount = calls.filter(c => c.outcome === 'confirmed').length;
  const rescheduledCount = calls.filter(c => c.outcome === 'rescheduled').length;
  const actionNeededCount = calls.filter(c => c.outcome === 'action_needed').length;
  const escalationCount = calls.filter(c => c.escalation_required).length;

  return (
    <div className="space-y-6 stagger-children">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
          AI Conversation Logs
        </h1>
        <p className="text-muted-foreground mt-1">
          Review automated patient interactions with full transparency and audit trail.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'glass-card p-4 text-left transition-all',
            filter === 'all' && 'ring-1 ring-primary'
          )}
        >
          <p className="text-2xl font-semibold text-foreground">{calls.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Conversations</p>
        </button>
        <button
          onClick={() => setFilter('confirmed')}
          className={cn(
            'glass-card p-4 text-left transition-all',
            filter === 'confirmed' && 'ring-1 ring-primary'
          )}
        >
          <p className="text-2xl font-semibold text-primary">{confirmedCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Successfully Confirmed</p>
        </button>
        <button
          onClick={() => setFilter('rescheduled')}
          className={cn(
            'glass-card p-4 text-left transition-all',
            filter === 'rescheduled' && 'ring-1 ring-info'
          )}
        >
          <p className="text-2xl font-semibold text-info">{rescheduledCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Autonomously Rescheduled</p>
        </button>
        <button
          onClick={() => setFilter('action_needed')}
          className={cn(
            'glass-card p-4 text-left transition-all',
            filter === 'action_needed' && 'ring-1 ring-destructive'
          )}
        >
          <p className="text-2xl font-semibold text-destructive">{actionNeededCount}</p>
          <p className="text-xs text-muted-foreground mt-1">Requires Staff Action</p>
        </button>
      </div>

      {/* HIPAA Compliance Status */}
      <div className="glass-card p-4 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            <span className="text-sm font-medium text-success">HIPAA Compliant</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm text-muted-foreground">AI Active</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <span className="text-sm text-muted-foreground">Pending Escalations:</span>
          <span className="text-sm font-medium text-warning">
            {escalationCount}
          </span>
        </div>
      </div>

      {/* Call List */}
      {filteredCalls.length === 0 ? (
        <EmptyState
          type="calls"
          title="No Matching Records"
          description={`No conversations match the selected filter "${filter.replace('_', ' ')}". Adjust your selection to view records.`}
        />
      ) : (
        <div className="space-y-3">
          {filteredCalls.map((call) => (
            <div key={call.id} className="glass-card overflow-hidden">
              {/* Call Header */}
              <button
                onClick={() => setExpandedId(expandedId === call.id ? null : call.id)}
                className={cn(
                  'w-full flex items-center gap-4 p-5 text-left',
                  'hover:bg-white/[0.02] transition-all duration-200'
                )}
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="text-base font-medium text-foreground">
                      {getPatientName(call.patient_id)}
                    </p>
                    {getStatusBadge(call.outcome)}
                    {call.escalation_required && (
                      <span className="text-xs text-amber-500 font-medium">Needs Review</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                    <span className="text-sm text-muted-foreground">
                      {getPatientPhone(call.patient_id)}
                    </span>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDuration(call.duration_seconds)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {format(parseISO(call.created_at), 'MMM d, h:mm a')}
                    </span>
                    {call.revenue_impact && (
                      <span className="text-sm text-primary font-medium">
                        +${call.revenue_impact.toLocaleString()} preserved
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {expandedId === call.id ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded Content */}
              {expandedId === call.id && (
                <div className="border-t border-white/5 animate-fade-up">
                  {/* Escalation Warning */}
                  {call.escalation_required && (
                    <div className="p-5 border-b border-white/5">
                      <EscalationFlag
                        reason={call.escalation_reason || 'AI was unable to complete this interaction autonomously.'}
                        onConvertToTask={() => handleConvertToTask(call)}
                      />
                    </div>
                  )}

                  {/* Call Information Panel */}
                  <div className="p-5 border-b border-white/5 bg-white/[0.01]">
                    <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                      Call Information
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 rounded-xl bg-white/[0.02]">
                        <p className="text-xs text-muted-foreground">Processing Time</p>
                        <p className="text-lg font-semibold text-foreground mt-1">
                          {call.processing_time_ms || 0}ms
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-white/[0.02]">
                        <p className="text-xs text-muted-foreground">Status</p>
                        <p className="text-lg font-semibold text-foreground mt-1">
                          {call.escalation_required ? 'Escalated' : 'Completed'}
                        </p>
                      </div>
                    </div>
                    {call.escalation_reason && (
                      <div className="mt-4 p-3 rounded-xl bg-white/[0.02]">
                        <p className="text-xs text-muted-foreground">Escalation Reason</p>
                        <p className="text-sm text-foreground mt-1">
                          {call.escalation_reason}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Transcript */}
                  <div className="p-5">
                    <p className="text-xs font-medium text-muted-foreground mb-4 uppercase tracking-wider">
                      Full Conversation Transcript
                    </p>
                    {call.transcript && Array.isArray(call.transcript) && call.transcript.length > 0 ? (
                      <div className="space-y-3">
                        {(call.transcript as Array<{ role: string; message: string; timestamp: string }>).map((msg, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              'flex gap-3',
                              msg.role === 'patient' && 'flex-row-reverse'
                            )}
                          >
                            <div
                              className={cn(
                                'h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0',
                                msg.role === 'ai' ? 'bg-primary/10' : 'bg-secondary'
                              )}
                            >
                              {msg.role === 'ai' ? (
                                <Bot className="h-4 w-4 text-primary" />
                              ) : (
                                <User className="h-4 w-4 text-secondary-foreground" />
                              )}
                            </div>
                            <div
                              className={cn(
                                'max-w-[75%]',
                                msg.role === 'ai' ? 'message-ai' : 'message-patient'
                              )}
                            >
                              <p className="text-sm text-foreground">{msg.message}</p>
                              <p className="text-xs text-muted-foreground mt-1.5">{msg.timestamp}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No transcript available for this call.</p>
                    )}
                  </div>

                  {/* Call Tools Panel */}
                  <CallToolsPanel
                    call={call}
                    patientName={getPatientName(call.patient_id)}
                    onActionComplete={() => setExpandedId(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
