import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/states/LoadingState';
import { EmptyState } from '@/components/states/EmptyState';
import { useNavigate } from 'react-router-dom';
import { useTodaysAppointments } from '@/hooks/useAppointments';

export function UpcomingAppointments() {
  const navigate = useNavigate();
  const { appointments, isLoading } = useTodaysAppointments();
  
  const todayAppointments = appointments.slice(0, 4);

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="mb-6">
          <div className="h-5 w-36 bg-muted/30 rounded animate-pulse" />
          <div className="h-4 w-48 bg-muted/30 rounded animate-pulse mt-2" />
        </div>
        <LoadingState variant="list" rows={4} />
      </div>
    );
  }

  if (todayAppointments.length === 0) {
    return (
      <div className="glass-card p-6">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground">Today's Schedule</h3>
          <p className="text-sm text-muted-foreground mt-1">No appointments scheduled</p>
        </div>
        <EmptyState 
          type="appointments" 
          title="No Appointments Today"
          description="There are no scheduled appointments for today. Use the calendar to view upcoming days."
        />
      </div>
    );
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="glass-card hover-glow p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">Today's Schedule</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {todayAppointments.length} appointment{todayAppointments.length !== 1 ? 's' : ''} scheduled
        </p>
      </div>

      <div className="space-y-3">
        {todayAppointments.map((apt) => (
          <div
            key={apt.id}
            className={cn(
              'p-4 rounded-xl transition-all duration-200',
              'border-l-2',
              apt.status === 'confirmed' && 'border-l-primary bg-primary/5',
              apt.status === 'rescheduled' && 'border-l-info bg-info/5',
              apt.status === 'scheduled' && 'border-l-muted bg-muted/20',
              apt.status === 'cancelled' && 'border-l-destructive bg-destructive/5'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">
                    {apt.patient ? `${apt.patient.first_name} ${apt.patient.last_name}` : 'Unknown'}
                  </p>
                  {apt.ai_managed && (
                    <CheckCircle className="h-3.5 w-3.5 text-success flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">{apt.procedure_name}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-secondary-foreground flex-shrink-0">
                <Clock className="h-3.5 w-3.5" />
                {formatTime(apt.scheduled_at)}
              </div>
            </div>
            {apt.conflict_warning && (
              <div className="flex items-center gap-1 mt-2 text-xs text-warning">
                <AlertTriangle className="h-3 w-3" />
                <span className="truncate">{apt.conflict_warning}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <button 
        onClick={() => navigate('/calendar')}
        className="w-full mt-4 py-2.5 text-sm text-primary hover:text-primary/80 transition-colors"
      >
        View Full Calendar
      </button>
    </div>
  );
}
