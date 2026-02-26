/**
 * ORADESK AI — OPERATIONAL SCHEDULING COMMAND CENTER
 * ═══════════════════════════════════════════════════════════
 *
 * Architecture:
 *   S1: KPI Operation Strip (5 metrics)
 *   S2: Daily Revenue Target Bar
 *   S3: Weekly Calendar Grid (revenue-aware, gap intelligence)
 *   S4: Appointment Detail Panel (lazy slide-over)
 *   S5: Add Appointment Modal (minimal)
 *
 * UX Principles:
 *   - Revenue numbers visually dominant
 *   - Risk visually clear
 *   - Zero cognitive overload
 *   - Smooth slide transitions (200-250ms)
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Clock, Plus, Calendar as CalendarIcon,
  ShieldCheck, AlertTriangle, DollarSign, Bot, Users, Activity,
  TrendingUp, Search, X, Zap, Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useClinic, WorkingHours } from '@/contexts/ClinicContext';
import { LoadingState } from '@/components/states/LoadingState';
import { ErrorState } from '@/components/states/ErrorState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  format, startOfWeek, addDays, isSameDay, parseISO, addHours,
} from 'date-fns';
import {
  useSchedulingIntelligence,
  usePatientSearch,
  getProcedureValue,
  getProcedureDuration,
  PROCEDURES,
  DURATIONS,
  type CalendarAppointment,
  type GapSuggestion,
} from '@/hooks/useSchedulingIntelligence';
import { AppointmentDetailPanel } from '@/components/calendar/AppointmentDetailPanel';
import {
  staggerContainerVariants,
  staggerChildVariants,
  EASE_OUT_CUBIC,
  TIMING,
} from '@/lib/animations';
import { usePatients } from '@/hooks/usePatients';

// ─── Constants ──────────────────────────────────────────────

const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00',
];

const DEFAULT_WORKING_HOURS: WorkingHours = {
  monday: { start: '08:00', end: '17:00', closed: false },
  tuesday: { start: '08:00', end: '17:00', closed: false },
  wednesday: { start: '08:00', end: '17:00', closed: false },
  thursday: { start: '08:00', end: '17:00', closed: false },
  friday: { start: '08:00', end: '17:00', closed: false },
  saturday: { start: '09:00', end: '13:00', closed: false },
  sunday: { start: '00:00', end: '00:00', closed: true },
};

// ═══════════════════════════════════════════════════════════
// S1: KPI OPERATION STRIP
// ═══════════════════════════════════════════════════════════

function KPIStrip({ kpis }: { kpis: ReturnType<typeof useSchedulingIntelligence>['kpis'] }) {
  const metrics = [
    {
      label: 'Today Fill Rate',
      value: `${kpis.fillRate}%`,
      icon: <Target className="h-4 w-4 text-primary" />,
      bg: 'bg-primary/10',
      valueColor: kpis.fillRate >= 80 ? 'text-emerald-600' : kpis.fillRate >= 50 ? 'text-amber-600' : 'text-foreground',
    },
    {
      label: 'Revenue Today',
      value: `$${kpis.revenueToday.toLocaleString()}`,
      icon: <DollarSign className="h-4 w-4 text-emerald-600" />,
      bg: 'bg-emerald-50',
      valueColor: 'text-emerald-600',
    },
    {
      label: 'Unconfirmed',
      value: kpis.unconfirmed.toString(),
      icon: <Clock className="h-4 w-4 text-amber-600" />,
      bg: 'bg-amber-50',
      valueColor: kpis.unconfirmed > 0 ? 'text-amber-600' : 'text-muted-foreground',
    },
    {
      label: 'High Value Cases',
      value: kpis.highValueCases.toString(),
      icon: <TrendingUp className="h-4 w-4 text-primary" />,
      bg: 'bg-primary/10',
      valueColor: kpis.highValueCases > 0 ? 'text-primary' : 'text-muted-foreground',
    },
    {
      label: 'No-Show Risk',
      value: kpis.noShowRisk.toString(),
      icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
      bg: 'bg-red-50',
      valueColor: kpis.noShowRisk > 0 ? 'text-red-500' : 'text-muted-foreground',
    },
  ];

  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3"
    >
      {metrics.map((m) => (
        <motion.div
          key={m.label}
          variants={staggerChildVariants}
          className="bg-card border border-border/60 rounded-xl p-4 flex flex-col gap-2 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
              {m.label}
            </span>
            <div className={cn('p-1.5 rounded-lg', m.bg)}>{m.icon}</div>
          </div>
          <p className={cn('text-xl font-bold tracking-tight tabular-nums', m.valueColor)}>{m.value}</p>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════
// S2: REVENUE TARGET BAR
// ═══════════════════════════════════════════════════════════

function RevenueTargetBar({ target }: { target: ReturnType<typeof useSchedulingIntelligence>['revenueTarget'] }) {
  const isComplete = target.percentage >= 100;

  return (
    <div className={cn(
      'bg-card border rounded-xl px-5 py-3 flex items-center gap-4 shadow-sm transition-all',
      isComplete ? 'border-emerald-200 bg-emerald-50/30' : 'border-border/60',
    )}>
      <div className="flex items-center gap-2 min-w-fit">
        <Target className={cn('h-4 w-4', isComplete ? 'text-emerald-600' : 'text-muted-foreground')} />
        <span className="text-xs font-semibold text-muted-foreground">Daily Target</span>
      </div>
      <div className="flex-1 h-2.5 bg-secondary rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${target.percentage}%` }}
          transition={{ duration: 0.6, ease: EASE_OUT_CUBIC }}
          className={cn(
            'h-full rounded-full',
            isComplete
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
              : 'bg-gradient-to-r from-primary to-primary/70',
          )}
        />
      </div>
      <div className="flex items-center gap-3 text-xs tabular-nums min-w-fit">
        <span className="font-bold text-emerald-600">${target.booked.toLocaleString()}</span>
        <span className="text-muted-foreground/40">/</span>
        <span className="font-semibold text-muted-foreground">${target.target.toLocaleString()}</span>
        {target.remaining > 0 && (
          <span className="text-amber-600 font-semibold">
            (${target.remaining.toLocaleString()} left)
          </span>
        )}
        {isComplete && (
          <span className="text-emerald-600 font-bold text-[10px] uppercase">✓ Target Met</span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// S5: ADD APPOINTMENT MODAL
// ═══════════════════════════════════════════════════════════

function AddAppointmentModal({
  open,
  onClose,
  selectedDate,
  selectedTime,
  onCreate,
  isCreating,
}: {
  open: boolean;
  onClose: () => void;
  selectedDate: string;
  selectedTime: string;
  onCreate: (input: any) => void;
  isCreating: boolean;
}) {
  const { patients } = usePatients();
  const { searchTerm, setSearchTerm, results, isSearching } = usePatientSearch();

  const [patientId, setPatientId] = useState('');
  const [patientLabel, setPatientLabel] = useState('');
  const [procedure, setProcedure] = useState('');
  const [duration, setDuration] = useState('30');
  const [autoValue, setAutoValue] = useState(0);
  const [aiConfirm, setAiConfirm] = useState(true);
  const [notes, setNotes] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (open) {
      setPatientId('');
      setPatientLabel('');
      setProcedure('');
      setDuration('30');
      setAutoValue(0);
      setAiConfirm(true);
      setNotes('');
      setSearchTerm('');
      setShowSearch(false);
    }
  }, [open, setSearchTerm]);

  useEffect(() => {
    if (procedure) {
      setAutoValue(getProcedureValue(procedure));
      setDuration(String(getProcedureDuration(procedure)));
    }
  }, [procedure]);

  const handleSubmit = () => {
    if (!patientId || !procedure) return;
    const scheduledAt = `${selectedDate}T${selectedTime}:00`;
    onCreate({
      patient_id: patientId,
      scheduled_at: scheduledAt,
      procedure_name: procedure,
      duration_minutes: parseInt(duration, 10),
      notes: notes || null,
      ai_managed: aiConfirm,
    });
    onClose();
  };

  const selectPatient = (p: { id: string; first_name: string; last_name: string }) => {
    setPatientId(p.id);
    setPatientLabel(`${p.first_name} ${p.last_name}`);
    setShowSearch(false);
    setSearchTerm('');
  };

  // Combined list: search results or all patients
  const patientList = searchTerm.length >= 2 ? results : patients.slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-card border border-border rounded-2xl p-0 overflow-hidden sm:max-w-md shadow-lg">
        <DialogTitle className="sr-only">Schedule Appointment</DialogTitle>

        <div className="bg-secondary/50 border-b border-border/50 px-5 py-4 flex items-center gap-3">
          <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
            <CalendarIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Schedule Appointment</h3>
            <p className="text-[10px] text-muted-foreground">
              {selectedDate && format(parseISO(selectedDate), 'EEEE, MMM d')} at {selectedTime && format(parseISO(`1970-01-01T${selectedTime}:00`), 'h:mm a')}
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">

          {/* Patient Search */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Patient</Label>
            {patientId ? (
              <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-3 py-2.5">
                <span className="text-sm font-semibold text-primary">{patientLabel}</span>
                <button
                  onClick={() => { setPatientId(''); setPatientLabel(''); }}
                  className="p-1 hover:bg-primary/10 rounded"
                >
                  <X className="h-3 w-3 text-primary" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Input
                  placeholder="Search by name or phone..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowSearch(true);
                  }}
                  onFocus={() => setShowSearch(true)}
                  className="h-10 text-sm pl-9 rounded-xl"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                {showSearch && patientList.length > 0 && (
                  <div className="absolute top-full mt-1 left-0 right-0 bg-card border border-border rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                    {patientList.map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => selectPatient(p)}
                        className="w-full text-left px-3 py-2.5 text-xs hover:bg-secondary/50 border-b border-border/30 last:border-b-0 flex items-center justify-between"
                      >
                        <span className="font-semibold text-foreground">{p.first_name} {p.last_name}</span>
                        <span className="text-muted-foreground">{p.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Procedure */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Procedure</Label>
            <Select value={procedure} onValueChange={setProcedure}>
              <SelectTrigger className="h-10 text-sm rounded-xl">
                <SelectValue placeholder="Select procedure" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border rounded-xl">
                {PROCEDURES.map((proc) => (
                  <SelectItem key={proc} value={proc} className="text-xs">
                    <div className="flex items-center justify-between gap-6 w-full">
                      <span>{proc}</span>
                      <span className="text-emerald-600 font-bold tabular-nums">${getProcedureValue(proc)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duration + Revenue (auto-fill) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="h-10 text-sm rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border rounded-xl">
                  {DURATIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Est. Revenue</Label>
              <div className="h-10 px-3 rounded-xl border border-border bg-emerald-50/50 flex items-center">
                <span className="text-sm font-bold text-emerald-600 tabular-nums">
                  ${autoValue.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* AI Auto-Confirm Toggle */}
          <div className="flex items-center justify-between bg-secondary/50 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">AI Auto-Confirm</span>
            </div>
            <button
              onClick={() => setAiConfirm(!aiConfirm)}
              className={cn(
                'w-10 h-5 rounded-full transition-colors relative',
                aiConfirm ? 'bg-primary' : 'bg-border',
              )}
            >
              <div className={cn(
                'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm',
                aiConfirm ? 'translate-x-5' : 'translate-x-0.5',
              )} />
            </button>
          </div>

          {/* Notes (optional) */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special instructions..."
              rows={2}
              className="text-sm rounded-xl resize-none"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2 border-t border-border/50">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl text-sm font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!patientId || !procedure || isCreating}
              className="flex-1 bg-primary text-white hover:bg-primary/90 h-10 rounded-xl text-sm font-semibold"
            >
              {isCreating ? 'Booking...' : 'Book Appointment'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN CALENDAR PAGE
// ═══════════════════════════════════════════════════════════

export default function Calendar() {
  const {
    appointments,
    kpis,
    revenueTarget,
    getGapsForDate,
    isLoading,
    isError,
    createAppointment,
    updateAppointment,
    cancelAppointment,
    isCreating,
    isUpdating,
  } = useSchedulingIntelligence();

  const { patients } = usePatients();
  const { currentClinic } = useClinic();

  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
  );
  const [selectedAppointment, setSelectedAppointment] = useState<CalendarAppointment | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: string; time: string }>({ date: '', time: '' });

  const workingHours: WorkingHours =
    (currentClinic?.working_hours as WorkingHours) ?? DEFAULT_WORKING_HOURS;

  // ── Week Dates ────────────────────────────────────────
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(currentWeekStart, i);
      return {
        day: format(date, 'EEE'),
        date: format(date, 'dd'),
        full: format(date, 'yyyy-MM-dd'),
        dateObj: date,
        isToday: isSameDay(date, new Date()),
      };
    });
  }, [currentWeekStart]);

  // ── Helpers ───────────────────────────────────────────
  const getPatientName = useCallback((patientId: string) => {
    const p = patients.find((p) => p.id === patientId);
    return p ? `${p.first_name} ${p.last_name}` : 'Unknown';
  }, [patients]);

  const getAppointmentForSlot = useCallback((date: string, time: string): CalendarAppointment | undefined => {
    return appointments.find((apt) => {
      const aptDate = format(parseISO(apt.scheduled_at), 'yyyy-MM-dd');
      const aptTime = format(parseISO(apt.scheduled_at), 'HH:mm');
      return aptDate === date && aptTime === time;
    });
  }, [appointments]);

  const isSlotAvailable = useCallback((dayName: string, time: string): boolean => {
    const dayKey = dayName.toLowerCase().slice(0, 3);
    const dayMap: Record<string, string> = {
      mon: 'monday', tue: 'tuesday', wed: 'wednesday',
      thu: 'thursday', fri: 'friday', sat: 'saturday', sun: 'sunday',
    };
    const hours = workingHours[dayMap[dayKey]];
    if (!hours || hours.closed) return false;
    return time >= hours.start && time < hours.end;
  }, [workingHours]);

  const getGapForSlot = useCallback((date: string, time: string): GapSuggestion | undefined => {
    const gaps = getGapsForDate(date);
    return gaps.find((g) => g.startTime <= time && g.endTime > time);
  }, [getGapsForDate]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart((prev) => addDays(prev, direction === 'prev' ? -7 : 7));
  };

  const goToCurrentWeek = () => {
    setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));
  };

  const handleSlotClick = (date: string, time: string) => {
    setSelectedSlot({ date, time });
    setAddModalOpen(true);
  };

  const isCurrentWeek = isSameDay(currentWeekStart, startOfWeek(new Date(), { weekStartsOn: 1 }));

  // ── Status Colors ─────────────────────────────────────
  const getStatusStyle = (status: string, noShowProb: number) => {
    const isHighRisk = noShowProb > 60;
    const base = {
      confirmed: 'bg-emerald-50/80 border-emerald-200 hover:border-emerald-300',
      scheduled: 'bg-amber-50/60 border-amber-200 hover:border-amber-300',
      rescheduled: 'bg-orange-50/60 border-orange-200 hover:border-orange-300',
      completed: 'bg-blue-50/60 border-blue-200 hover:border-blue-300',
      missed: 'bg-red-50/60 border-red-200 hover:border-red-300',
      cancelled: 'bg-gray-50/60 border-gray-200',
    };
    const style = base[status as keyof typeof base] ?? base.scheduled;
    return isHighRisk ? style + ' ring-1 ring-red-300' : style;
  };

  const getStatusDot = (status: string) => {
    const colors: Record<string, string> = {
      confirmed: 'bg-emerald-500',
      scheduled: 'bg-amber-500',
      rescheduled: 'bg-orange-500',
      completed: 'bg-blue-500',
      missed: 'bg-red-500',
      cancelled: 'bg-gray-400',
    };
    return colors[status] ?? 'bg-gray-400';
  };

  // ── Loading / Error ───────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <div className="h-8 w-48 bg-secondary rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-secondary/50 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-secondary/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <LoadingState variant="table" rows={6} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
        <ErrorState
          title="Connection Error"
          description="Unable to retrieve scheduling data."
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500 pb-20">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Schedule</h1>
          <p className="text-sm text-muted-foreground">
            {format(currentWeekStart, 'MMMM yyyy')} — Week of {format(currentWeekStart, 'MMM d')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* PMS Sync Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </div>
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">PMS Synced</span>
          </div>

          {/* Week Nav */}
          <div className="flex items-center gap-1 bg-card p-1 border border-border rounded-xl shadow-sm">
            <button
              onClick={() => navigateWeek('prev')}
              className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={goToCurrentWeek}
              className={cn(
                'px-4 py-1.5 text-xs font-bold transition-all rounded-lg',
                isCurrentWeek
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
              )}
            >
              Today
            </button>
            <button
              onClick={() => navigateWeek('next')}
              className="p-2 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── S1: KPI Strip ──────────────────────────────── */}
      <KPIStrip kpis={kpis} />

      {/* ── S2: Revenue Target Bar ─────────────────────── */}
      <RevenueTargetBar target={revenueTarget} />

      {/* ── S3: Calendar Grid ──────────────────────────── */}
      <div className="bg-card border border-border/60 shadow-sm rounded-2xl overflow-hidden">
        {/* Grid Header */}
        <div className="grid grid-cols-8 border-b border-border bg-secondary/40">
          <div className="p-3 text-[10px] font-bold text-muted-foreground border-r border-border flex items-center justify-center uppercase tracking-wider">
            Time
          </div>
          {weekDates.map((d) => (
            <div key={d.full} className={cn(
              'p-3 text-center border-r border-border last:border-r-0 relative',
              d.isToday && 'bg-primary/5',
            )}>
              {d.isToday && <div className="absolute top-0 left-0 w-full h-0.5 bg-primary" />}
              <p className={cn(
                'text-[10px] font-semibold uppercase tracking-wider mb-0.5',
                d.isToday ? 'text-primary/70' : 'text-muted-foreground',
              )}>
                {d.day}
              </p>
              <p className={cn(
                'text-lg font-bold',
                d.isToday ? 'text-primary' : 'text-foreground',
              )}>
                {d.date}
              </p>
            </div>
          ))}
        </div>

        {/* Grid Body */}
        <div className="max-h-[560px] overflow-y-auto custom-scrollbar">
          {TIME_SLOTS.map((time) => (
            <div key={time} className="grid grid-cols-8 border-b border-border/30 last:border-b-0">
              <div className="p-3 text-[10px] font-bold text-muted-foreground flex items-center justify-center border-r border-border/30 h-[88px] uppercase tracking-wider">
                {format(parseISO(`1970-01-01T${time}:00`), 'h a')}
              </div>
              {weekDates.map((d) => {
                const apt = getAppointmentForSlot(d.full, time);
                const available = isSlotAvailable(d.day, time);
                const gap = !apt && available ? getGapForSlot(d.full, time) : undefined;

                return (
                  <div
                    key={`${d.full}-${time}`}
                    className={cn(
                      'relative border-r border-border/30 last:border-r-0 h-[88px] group transition-colors',
                      !available && 'bg-secondary/30 pointer-events-none',
                      available && !apt && 'hover:bg-secondary/20 cursor-pointer',
                    )}
                    onClick={() => available && !apt && handleSlotClick(d.full, time)}
                  >
                    {apt ? (
                      /* ── Appointment Block ── */
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedAppointment(apt); }}
                        className={cn(
                          'absolute inset-1 p-2 rounded-lg border transition-all flex flex-col justify-between overflow-hidden text-left shadow-sm hover:shadow',
                          getStatusStyle(apt.status, apt.no_show_probability),
                        )}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="text-[11px] font-bold text-foreground truncate leading-tight">
                            {apt.patient ? `${apt.patient.first_name} ${apt.patient.last_name}` : getPatientName(apt.patient_id)}
                          </p>
                          <p className="text-[9px] font-semibold text-muted-foreground truncate uppercase tracking-widest">
                            {apt.procedure_name}
                          </p>
                        </div>
                        <div className="flex items-center justify-between w-full mt-1">
                          <span className="text-[10px] font-bold text-emerald-600 tabular-nums">
                            ${apt.estimated_value}
                          </span>
                          <div className="flex items-center gap-1">
                            {apt.confirmation_source === 'ai' && (
                              <div className="flex items-center gap-0.5 px-1 py-px bg-primary/10 rounded border border-primary/15">
                                <Bot className="h-[8px] w-[8px] text-primary" />
                                <span className="text-[7px] font-bold text-primary uppercase">AI</span>
                              </div>
                            )}
                            {apt.no_show_probability > 60 && (
                              <AlertTriangle className="h-3 w-3 text-red-500" />
                            )}
                            <div className={cn('h-2 w-2 rounded-full', getStatusDot(apt.status))} />
                          </div>
                        </div>
                      </button>
                    ) : gap ? (
                      /* ── Gap Suggestion ── */
                      <div
                        className="absolute inset-1.5 rounded-lg border border-dashed border-primary/20 bg-primary/3 flex items-center justify-center p-2 cursor-pointer hover:bg-primary/5 transition-colors"
                        onClick={(e) => { e.stopPropagation(); handleSlotClick(d.full, time); }}
                      >
                        <div className="text-center">
                          <Zap className="h-3 w-3 text-primary/40 mx-auto mb-0.5" />
                          <p className="text-[8px] text-primary/50 italic leading-tight">
                            AI: {gap.suggestion}
                          </p>
                        </div>
                      </div>
                    ) : available ? (
                      /* ── Empty Slot Hover ── */
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <Plus className="h-5 w-5 text-primary/30" />
                      </div>
                    ) : (
                      /* ── Closed Slot ── */
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-px w-full bg-border/30 absolute top-1/2" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Legend ──────────────────────────────────────── */}
      <div className="flex items-center gap-6 flex-wrap px-4 py-3 bg-card border border-border/60 shadow-sm rounded-xl">
        {[
          { label: 'Confirmed', color: 'bg-emerald-500' },
          { label: 'Pending', color: 'bg-amber-500' },
          { label: 'Rescheduled', color: 'bg-orange-500' },
          { label: 'Completed', color: 'bg-blue-500' },
          { label: 'High Risk', color: 'bg-red-500' },
          { label: 'Available', color: 'bg-white border border-border' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <div className={cn('h-2.5 w-2.5 rounded-full', item.color)} />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{item.label}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full">
          <ShieldCheck className="h-3 w-3 text-emerald-600" />
          <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest">HIPAA Secure</span>
        </div>
      </div>

      {/* ── S4: Appointment Detail Panel ───────────────── */}
      <AnimatePresence>
        {selectedAppointment && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-foreground/5 backdrop-blur-[2px] z-30"
              onClick={() => setSelectedAppointment(null)}
            />
            <AppointmentDetailPanel
              appointment={selectedAppointment}
              onClose={() => setSelectedAppointment(null)}
              onReschedule={() => {
                if (selectedAppointment) {
                  const newTime = addHours(parseISO(selectedAppointment.scheduled_at), 24);
                  updateAppointment({
                    id: selectedAppointment.id,
                    scheduled_at: newTime.toISOString(),
                    status: 'rescheduled',
                  });
                  setSelectedAppointment(null);
                }
              }}
              onCancel={() => {
                if (selectedAppointment) {
                  cancelAppointment(selectedAppointment.id);
                  setSelectedAppointment(null);
                }
              }}
              onConfirm={() => {
                if (selectedAppointment) {
                  updateAppointment({
                    id: selectedAppointment.id,
                    status: 'confirmed',
                  });
                  setSelectedAppointment(null);
                }
              }}
              onConvertFollowUp={() => {
                // Navigate to patients tab with follow-up modal
                setSelectedAppointment(null);
              }}
              isUpdating={isUpdating}
            />
          </>
        )}
      </AnimatePresence>

      {/* ── S5: Add Appointment Modal ──────────────────── */}
      <AddAppointmentModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        selectedDate={selectedSlot.date}
        selectedTime={selectedSlot.time}
        onCreate={createAppointment}
        isCreating={isCreating}
      />
    </div>
  );
}
