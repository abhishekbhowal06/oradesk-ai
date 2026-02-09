import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Clock, User, AlertTriangle, Lock, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClinic, WorkingHours } from '@/contexts/ClinicContext';
import { LoadingState } from '@/components/states/LoadingState';
import { ErrorState } from '@/components/states/ErrorState';
import { SystemTooltip } from '@/components/ui/SystemTooltip';
import { useAppointments, Appointment } from '@/hooks/useAppointments';
import { usePatients } from '@/hooks/usePatients';
import { format, startOfWeek, addDays, isSameDay, parseISO, addHours } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { ScheduleAppointmentDialog } from '@/components/calendar/ScheduleAppointmentDialog';

const timeSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

const defaultWorkingHours: WorkingHours = {
  monday: { start: '08:00', end: '17:00', closed: false },
  tuesday: { start: '08:00', end: '17:00', closed: false },
  wednesday: { start: '08:00', end: '17:00', closed: false },
  thursday: { start: '08:00', end: '17:00', closed: false },
  friday: { start: '08:00', end: '17:00', closed: false },
  saturday: { start: '09:00', end: '13:00', closed: false },
  sunday: { start: '00:00', end: '00:00', closed: true },
};

export default function Calendar() {
  const { appointments, isLoading, isError, updateAppointment, isUpdating } = useAppointments();
  const { patients } = usePatients();
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  
  // Schedule dialog state
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string } | null>(null);

  const handleSlotClick = (date: string, time: string) => {
    setSelectedSlot({ date, time });
    setScheduleDialogOpen(true);
  };
  
  // Get working hours from clinic settings or use defaults
  const workingHours: WorkingHours = (currentClinic?.working_hours as WorkingHours) ?? defaultWorkingHours;

  const handleReschedule = (apt: Appointment) => {
    // For now, reschedule to next available slot (24 hours later)
    const newTime = addHours(parseISO(apt.scheduled_at), 24);
    updateAppointment({
      id: apt.id,
      scheduled_at: newTime.toISOString(),
      status: 'rescheduled',
    });
    setSelectedAppointment(null);
    toast({
      title: 'Appointment Rescheduled',
      description: `Moved to ${format(newTime, 'EEEE, MMM d')} at ${format(newTime, 'h:mm a')}`,
    });
  };

  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(currentWeekStart, i);
      return {
        day: format(date, 'EEE'),
        date: format(date, 'dd'),
        full: format(date, 'yyyy-MM-dd'),
        dateObj: date,
      };
    });
  }, [currentWeekStart]);

  const getPatientName = (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    return patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown Patient';
  };

  const getAppointmentForSlot = (date: string, time: string): Appointment | undefined => {
    return appointments.find((apt) => {
      const aptDate = format(parseISO(apt.scheduled_at), 'yyyy-MM-dd');
      const aptTime = format(parseISO(apt.scheduled_at), 'HH:mm');
      return aptDate === date && aptTime === time;
    });
  };

  const isSlotAvailable = (dayName: string, time: string): boolean => {
    const dayKey = dayName.toLowerCase().slice(0, 3);
    const dayMap: Record<string, string> = {
      mon: 'monday',
      tue: 'tuesday',
      wed: 'wednesday',
      thu: 'thursday',
      fri: 'friday',
      sat: 'saturday',
      sun: 'sunday',
    };
    const hours = workingHours[dayMap[dayKey]];
    if (!hours || hours.closed) return false;
    return time >= hours.start && time < hours.end;
  };

  const getSlotClass = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'calendar-slot-confirmed';
      case 'rescheduled':
        return 'calendar-slot-rescheduled';
      case 'cancelled':
        return 'bg-destructive/10 border border-destructive/20';
      case 'missed':
        return 'bg-warning/10 border border-warning/20';
      default:
        return 'calendar-slot-open';
    }
  };

  const getAppointmentCount = (date: string) => {
    return appointments.filter(a => format(parseISO(a.scheduled_at), 'yyyy-MM-dd') === date).length;
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => addDays(prev, direction === 'prev' ? -7 : 7));
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
              Appointment Calendar
            </h1>
            <p className="text-muted-foreground mt-1">Loading schedule...</p>
          </div>
        </div>
        <LoadingState variant="table" rows={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
            Appointment Calendar
          </h1>
        </div>
        <ErrorState 
          title="Failed to Load Calendar"
          description="Unable to retrieve appointments. Please check your connection and try again."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  const isCurrentWeek = isSameDay(currentWeekStart, startOfWeek(new Date(), { weekStartsOn: 1 }));

  return (
    <div className="space-y-6 stagger-children">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
            Appointment Calendar
          </h1>
          <p className="text-muted-foreground mt-1">
            {format(currentWeekStart, 'MMMM yyyy')} — Week of {format(currentWeekStart, 'MMM d')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => navigateWeek('prev')}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <button 
            onClick={goToCurrentWeek}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-xl transition-colors",
              isCurrentWeek ? "bg-primary text-primary-foreground" : "bg-white/5 text-foreground hover:bg-white/10"
            )}
          >
            Current Week
          </button>
          <button 
            onClick={() => navigateWeek('next')}
            className="p-2 rounded-xl hover:bg-white/5 transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Overbooking Warnings */}
      {weekDates.some(d => getAppointmentCount(d.full) >= 6) && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-warning/10 border border-warning/20">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-warning">High Volume Days Detected</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Some days have 6+ appointments scheduled. Consider distributing workload.
            </p>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="glass-card overflow-hidden">
        {/* Days Header */}
        <div className="grid grid-cols-8 border-b border-white/5">
          <div className="p-4 text-sm font-medium text-muted-foreground">Time</div>
          {weekDates.map((d) => {
            const dayKey = d.day.toLowerCase().slice(0, 3);
            const dayMap: Record<string, string> = {
              mon: 'monday', tue: 'tuesday', wed: 'wednesday',
              thu: 'thursday', fri: 'friday', sat: 'saturday', sun: 'sunday',
            };
            const dayHours = workingHours[dayMap[dayKey]];
            const isClosed = dayHours?.closed;
            const isToday = isSameDay(d.dateObj, new Date());
            
            return (
              <div key={d.full} className={cn(
                "p-4 text-center border-l border-white/5",
                isClosed && "bg-white/[0.01]"
              )}>
                <p className="text-xs text-muted-foreground">{d.day}</p>
                <p className={cn(
                  'text-lg font-semibold mt-1',
                  isToday ? 'text-primary' : 'text-foreground'
                )}>
                  {d.date}
                </p>
                {isClosed && (
                  <p className="text-[10px] text-muted-foreground mt-1">Closed</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Time Slots */}
        <div className="max-h-[600px] overflow-y-auto">
          {timeSlots.map((time) => (
            <div key={time} className="grid grid-cols-8 border-b border-white/5 last:border-b-0">
              <div className="p-4 text-sm text-muted-foreground flex items-start">
                {time}
              </div>
              {weekDates.map((d) => {
                const apt = getAppointmentForSlot(d.full, time);
                const available = isSlotAvailable(d.day, time);
                
                return (
                  <div key={`${d.full}-${time}`} className={cn(
                    "p-2 border-l border-white/5 min-h-[80px]",
                    !available && "bg-white/[0.02]"
                  )}>
                    {apt ? (
                      <SystemTooltip 
                        content={
                          <div>
                            <p className="font-medium">{getPatientName(apt.patient_id)}</p>
                            <p className="text-muted-foreground">{apt.procedure_name}</p>
                            <p className="text-xs mt-1 capitalize">{apt.status}</p>
                            {apt.conflict_warning && (
                              <p className="text-warning text-xs mt-1">{apt.conflict_warning}</p>
                            )}
                          </div>
                        }
                      >
                        <button
                          onClick={() => setSelectedAppointment(apt.id)}
                          className={cn(
                            'w-full text-left p-2 rounded-xl transition-all duration-200',
                            getSlotClass(apt.status),
                            'hover:scale-[1.02]',
                            apt.conflict_warning && 'ring-1 ring-warning/50'
                          )}
                        >
                          <p className="text-sm font-medium text-foreground truncate">
                            {getPatientName(apt.patient_id)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {apt.procedure_name}
                          </p>
                          {apt.ai_managed && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-primary mt-1">
                              AI Verified
                            </span>
                          )}
                        </button>
                      </SystemTooltip>
                    ) : available ? (
                      <button
                        onClick={() => handleSlotClick(d.full, time)}
                        className="calendar-slot-open h-full w-full rounded-xl opacity-30 hover:opacity-60 hover:bg-primary/10 transition-all duration-200 flex items-center justify-center group"
                        aria-label={`Schedule appointment on ${d.full} at ${time}`}
                      >
                        <Plus className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ) : (
                      <div className="h-full rounded-xl flex items-center justify-center opacity-30">
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-primary" />
          <span className="text-sm text-muted-foreground">AI Confirmed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-info" />
          <span className="text-sm text-muted-foreground">AI Rescheduled</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-muted" />
          <span className="text-sm text-muted-foreground">Available Slot</span>
        </div>
        <div className="flex items-center gap-2">
          <Lock className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Outside Operating Hours</span>
        </div>
      </div>

      {/* Appointment Modal */}
      {selectedAppointment && (() => {
        const apt = appointments.find((a) => a.id === selectedAppointment);
        if (!apt) return null;
        const patientName = getPatientName(apt.patient_id);
        
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedAppointment(null)}
          >
            <div
              className="glass-card w-full max-w-md p-6 animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">{patientName}</h3>
                  <p className="text-sm text-muted-foreground">{apt.procedure_name}</p>
                </div>
              </div>
              
              {apt.conflict_warning && (
                <div className="mb-4 p-3 rounded-xl bg-warning/10 border border-warning/20">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <p className="text-xs text-warning">{apt.conflict_warning}</p>
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">
                    {format(parseISO(apt.scheduled_at), 'h:mm a')}
                  </span>
                  <span className="text-muted-foreground">
                    on {format(parseISO(apt.scheduled_at), 'EEEE, MMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'px-3 py-1 rounded-full text-xs font-medium capitalize',
                    apt.status === 'confirmed' && 'badge-confirmed',
                    apt.status === 'rescheduled' && 'badge-rescheduled',
                    apt.status === 'cancelled' && 'bg-destructive/20 text-destructive',
                    apt.status === 'missed' && 'bg-warning/20 text-warning'
                  )}>
                    {apt.status}
                  </span>
                  {apt.ai_managed && (
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/30">
                      AI Verified
                    </span>
                  )}
                </div>
                {apt.notes && (
                  <div className="p-3 rounded-xl bg-white/[0.02]">
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="text-sm text-foreground mt-1">{apt.notes}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setSelectedAppointment(null)}
                  className="flex-1 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground rounded-xl hover:bg-white/5 transition-colors"
                >
                  Close
                </button>
                <button 
                  onClick={() => handleReschedule(apt)}
                  disabled={isUpdating}
                  className="flex-1 btn-gold text-sm disabled:opacity-50"
                >
                  {isUpdating ? 'Rescheduling...' : 'Reschedule (+24h)'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Schedule Appointment Dialog */}
      {selectedSlot && (
        <ScheduleAppointmentDialog
          open={scheduleDialogOpen}
          onOpenChange={setScheduleDialogOpen}
          selectedDate={selectedSlot.date}
          selectedTime={selectedSlot.time}
        />
      )}
    </div>
  );
}
