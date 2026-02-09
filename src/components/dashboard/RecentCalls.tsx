import { Phone, ChevronRight, ShieldCheck } from 'lucide-react';
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
        return <span className="badge-confirmed">Confirmed</span>;
      case 'rescheduled':
        return <span className="badge-rescheduled">Rescheduled</span>;
      case 'action_needed':
        return <span className="badge-action">Action Required</span>;
      case 'cancelled':
        return <span className="badge-action">Cancelled</span>;
      case 'unreachable':
        return <span className="text-xs text-muted-foreground">Unreachable</span>;
      default:
        return null;
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="mb-6">
          <div className="h-5 w-40 bg-muted/30 rounded animate-pulse" />
          <div className="h-4 w-56 bg-muted/30 rounded animate-pulse mt-2" />
        </div>
        <LoadingState variant="list" rows={4} />
      </div>
    );
  }

  if (!recentCalls || recentCalls.length === 0) {
    return (
      <div className="glass-card p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground">Recent AI Conversations</h3>
          <p className="text-sm text-muted-foreground mt-1">Latest automated patient interactions</p>
        </div>
        <EmptyState
          type="calls"
          title="No Calls Yet"
          description="AI conversations will appear here as patients are contacted."
        />
      </div>
    );
  }

  return (
    <div className="glass-card hover-glow p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Recent AI Conversations</h3>
          <p className="text-sm text-muted-foreground mt-1">Latest automated patient interactions</p>
        </div>
        <button
          onClick={() => navigate('/calls')}
          className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
        >
          View all
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        {recentCalls.map((call) => (
          <div
            key={call.id}
            className={cn(
              'flex items-center gap-4 p-4 rounded-xl',
              'bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-200',
              'border border-transparent hover:border-white/5 cursor-pointer'
            )}
            onClick={() => navigate('/calls')}
          >
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Phone className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground truncate">
                  {call.patient ? `${call.patient.first_name} ${call.patient.last_name}` : 'Unknown Patient'}
                </p>
                {call.escalation_required && (
                  <span className="text-xs text-amber-500 font-medium">Needs Review</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground">
                  {formatDuration(call.duration_seconds)} duration
                </span>
                {call.revenue_impact && (
                  <span className="text-xs text-primary font-medium">
                    +${Number(call.revenue_impact).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
            {getStatusBadge(call.outcome)}
          </div>
        ))}
      </div>

      {/* HIPAA Compliance Notice */}
      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-success" />
          <span className="text-xs text-muted-foreground">
            HIPAA Compliant
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
          <span className="text-xs text-muted-foreground">Active</span>
        </div>
      </div>
    </div>
  );
}
