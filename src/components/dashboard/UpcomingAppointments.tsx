import { Clock, AlertTriangle, ShieldCheck, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/states/LoadingState';
import { EmptyState } from '@/components/states/EmptyState';
import { useNavigate } from 'react-router-dom';
import { useTodaysAppointments } from '@/hooks/useAppointments';

export function UpcomingAppointments() {
  const navigate = useNavigate();
  const { appointments, isLoading } = useTodaysAppointments();

  const todayAppointments = appointments.slice(0, 4);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed': return 'border-success/30 text-success bg-success/5';
      case 'rescheduled': return 'border-warning/30 text-warning bg-warning/5';
      case 'cancelled': return 'border-destructive/30 text-destructive bg-destructive/5';
      default: return 'border-border text-muted-foreground bg-muted/40';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (isLoading) {
    return (
      <div className="h-full flex flex-col justify-center">
        <LoadingState variant="list" rows={4} />
      </div>
    );
  }

  if (todayAppointments.length === 0) {
    return (
      <EmptyState
        type="appointments"
        title="Schedule Clear"
        description="There are no scheduled appointments today. Use the calendar to view future days."
      />
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="space-y-3 flex-1 overflow-y-auto custom-scrollbar">
        {todayAppointments.map((apt) => (
          <div
            key={apt.id}
            className={cn(
              'p-4 border rounded-xl transition-all duration-150 relative overflow-hidden bg-card',
              'hover:border-primary/30 hover:shadow-sm'
            )}
          >
            {/* Status Indicator Bar (Left Edge) */}
            <div className={cn(
              "absolute left-0 top-0 h-full w-[3px]",
              apt.status === 'confirmed' ? "bg-success" :
                apt.status === 'rescheduled' ? "bg-warning" :
                  apt.status === 'cancelled' ? "bg-destructive" :
                    "bg-muted-foreground"
            )} />

            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 pl-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground truncate">
                    {apt.patient ? `${apt.patient.first_name} ${apt.patient.last_name}` : 'Unknown Patient'}
                  </span>
                  {apt.ai_managed && (
                    <ShieldCheck className="h-[14px] w-[14px] text-primary" />
                  )}
                </div>
                <p className="text-xs font-medium text-muted-foreground mt-1 truncate max-w-[200px]">
                  {apt.procedure_name || 'General Checkup'}
                </p>
              </div>

              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  {formatTime(apt.scheduled_at)}
                </div>
                <span className={cn(
                  "text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded-md border capitalize",
                  getStatusBadge(apt.status)
                )}>
                  {apt.status}
                </span>
              </div>
            </div>

            {apt.conflict_warning && (
              <div className="flex items-center gap-2 mt-3 pt-2 text-[11px] font-semibold text-destructive mt-1 border-t border-destructive/10">
                <AlertTriangle className="h-[12px] w-[12px]" />
                <span className="truncate">{apt.conflict_warning}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate('/calendar')}
        className="w-full py-2.5 bg-secondary text-primary rounded-xl text-sm font-semibold hover:bg-primary hover:text-white transition-colors flex items-center justify-center gap-2"
      >
        View Calendar
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
