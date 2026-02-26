import { Phone, ChevronRight, Activity, Zap, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { LoadingState } from '@/components/states/LoadingState';
import { EmptyState } from '@/components/states/EmptyState';
import { useRecentCalls } from '@/hooks/useAICalls';

export function RecentCalls() {
  const navigate = useNavigate();
  const { data: recentCalls, isLoading } = useRecentCalls(4);

  const getStatusBadge = (outcome: string | null) => {
    switch (outcome) {
      case 'confirmed':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-success/10 border border-success/20 rounded-xl">
            <span className="text-xs font-semibold text-success capitalize tracking-wide">Confirmed</span>
          </div>
        );
      case 'rescheduled':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-warning/10 border border-warning/20 rounded-xl">
            <span className="text-xs font-semibold text-warning capitalize tracking-wide">Rescheduled</span>
          </div>
        );
      case 'action_needed':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-destructive/10 border border-destructive/20 rounded-xl">
            <span className="text-xs font-semibold text-destructive capitalize tracking-wide">Needs Action</span>
          </div>
        );
      case 'cancelled':
      case 'unreachable':
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-muted/40 border border-border rounded-xl">
            <span className="text-xs font-semibold text-muted-foreground capitalize tracking-wide">{outcome || 'Syncing'}</span>
          </div>
        );
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col justify-center">
        <LoadingState variant="list" rows={4} />
      </div>
    );
  }

  if (!recentCalls || recentCalls.length === 0) {
    return (
      <EmptyState
        type="calls"
        title="No Conversations Yet"
        description="AI conversations will appear here as patients are contacted."
      />
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar">
        {recentCalls.map((call) => (
          <div
            key={call.id}
            onClick={() => navigate('/calls')}
            className={cn(
              'flex items-center gap-4 p-4 border rounded-xl transition-all duration-150 cursor-pointer bg-card',
              'hover:border-primary/30 hover:shadow-sm'
            )}
          >
            {/* Call Indicator */}
            <div className="h-10 w-10 shrink-0 border border-primary/20 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <Phone className="h-[18px] w-[18px]" />
            </div>

            {/* Patient Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground truncate">
                  {call.patient ? `${call.patient.first_name} ${call.patient.last_name}` : 'Unknown Patient'}
                </span>
                {call.escalation_required && (
                  <div className="flex items-center px-2 py-0.5 bg-destructive/10 border border-destructive/20 rounded-md">
                    <span className="text-[10px] font-semibold text-destructive uppercase tracking-wide">Action Req.</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {formatDuration(call.duration_seconds)}
                </span>
                {call.revenue_impact && (
                  <div className="flex items-center gap-1 text-primary">
                    <Zap className="h-[10px] w-[10px]" />
                    <span className="text-xs font-semibold">
                      +${Number(call.revenue_impact).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Status Badge */}
            <div className="flex-shrink-0">
              {getStatusBadge(call.outcome)}
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate('/calls')}
        className="w-full py-2.5 bg-secondary text-primary rounded-xl text-sm font-semibold hover:bg-primary hover:text-white transition-colors flex items-center justify-center gap-2"
      >
        View Logs
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
