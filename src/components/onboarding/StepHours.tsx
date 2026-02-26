import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, ArrowRight, Loader2, Activity, ShieldCheck } from 'lucide-react';
import { WorkingHours } from '@/contexts/ClinicContext';
import { cn } from '@/lib/utils';

interface StepHoursProps {
  workingHours: WorkingHours;
  onSave: (hours: WorkingHours, callDuringHoursOnly: boolean) => Promise<void>;
  isLoading: boolean;
}

const DAYS = [
  { key: 'monday', label: 'MON' },
  { key: 'tuesday', label: 'TUE' },
  { key: 'wednesday', label: 'WED' },
  { key: 'thursday', label: 'THU' },
  { key: 'friday', label: 'FRI' },
  { key: 'saturday', label: 'SAT' },
  { key: 'sunday', label: 'SUN' },
];

const TIME_OPTIONS = [
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00',
  '20:00', '21:00', '22:00'
];

export function StepHours({ workingHours, onSave, isLoading }: StepHoursProps) {
  const [openTime, setOpenTime] = useState(workingHours.monday?.start || '09:00');
  const [closeTime, setCloseTime] = useState(workingHours.monday?.end || '19:00');
  const [workingDays, setWorkingDays] = useState<Record<string, boolean>>({
    monday: !workingHours.monday?.closed,
    tuesday: !workingHours.tuesday?.closed,
    wednesday: !workingHours.wednesday?.closed,
    thursday: !workingHours.thursday?.closed,
    friday: !workingHours.friday?.closed,
    saturday: !workingHours.saturday?.closed,
    sunday: !workingHours.sunday?.closed,
  });
  const [callDuringHoursOnly, setCallDuringHoursOnly] = useState(true);

  const handleDayToggle = (day: string) => {
    setWorkingDays((prev) => ({ ...prev, [day]: !prev[day] }));
  };

  const handleSave = async () => {
    const newHours: WorkingHours = {};
    DAYS.forEach(({ key }) => {
      newHours[key] = {
        start: openTime,
        end: closeTime,
        closed: !workingDays[key],
      };
    });
    await onSave(newHours, callDuringHoursOnly);
  };

  return (
    <div className="space-y-10">
      {/* Module Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-1 px-2 border border-primary/30 bg-primary/10">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-white uppercase italic tracking-tight">Temporal Windows</h2>
        </div>
        <p className="text-[11px] font-mono text-muted-foreground uppercase leading-relaxed max-w-md">
          Define primary operational cycles. The Neural Engine will synchronize its communication cadence with these parameters.
        </p>
      </div>

      {/* Grid: Time Pickers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-3 p-4 bg-white/5 border border-white/5">
          <Label className="text-[10px] font-mono font-bold text-primary uppercase tracking-widest">START_INDEX</Label>
          <Select value={openTime} onValueChange={setOpenTime}>
            <SelectTrigger className="rounded-none bg-black/40 border-white/10 font-mono text-sm uppercase h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none border-white/10 bg-[#051a1e]">
              {TIME_OPTIONS.map((time) => (
                <SelectItem key={time} value={time} className="font-mono text-xs uppercase focus:bg-primary/20">
                  {time} HOURS
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3 p-4 bg-white/5 border border-white/5">
          <Label className="text-[10px] font-mono font-bold text-primary uppercase tracking-widest">HALT_INDEX</Label>
          <Select value={closeTime} onValueChange={setCloseTime}>
            <SelectTrigger className="rounded-none bg-black/40 border-white/10 font-mono text-sm uppercase h-12">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none border-white/10 bg-[#051a1e]">
              {TIME_OPTIONS.map((time) => (
                <SelectItem key={time} value={time} className="font-mono text-xs uppercase focus:bg-primary/20">
                  {time} HOURS
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid: Working Days Matrix */}
      <div className="space-y-4">
        <Label className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-widest">ACTIVE_DAY_MATRIX</Label>
        <div className="grid grid-cols-4 md:grid-cols-7 gap-px bg-white/10 p-px">
          {DAYS.map(({ key, label }) => {
            const active = workingDays[key];
            return (
              <label
                key={key}
                className={cn(
                  "flex flex-col items-center justify-center py-4 cursor-pointer transition-all",
                  active ? "bg-primary/10 text-white" : "bg-black/40 text-muted-foreground opacity-40 hover:opacity-100"
                )}
              >
                <Checkbox
                  checked={active}
                  onCheckedChange={() => handleDayToggle(key)}
                  className="hidden"
                />
                <span className="text-[10px] font-mono font-bold tracking-widest">{label}</span>
                <div className={cn(
                  "h-1 w-4 mt-2",
                  active ? "bg-primary animate-pulse" : "bg-white/10"
                )} />
              </label>
            )
          })}
        </div>
      </div>

      {/* AI Hours Lock */}
      <div className="group relative overflow-hidden bg-black/40 border border-white/10 p-6 transition-all hover:border-info/30">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-[11px] font-mono font-bold text-white uppercase tracking-widest">
              HARD_WINDOW_STRICTURE
            </Label>
            <p className="text-[10px] font-mono text-muted-foreground uppercase opacity-60">
              Restrict Neural Engine transmissions to defined temporal indices only.
            </p>
          </div>
          <Switch
            checked={callDuringHoursOnly}
            onCheckedChange={setCallDuringHoursOnly}
            className="data-[state=checked]:bg-info"
          />
        </div>
        <div className="absolute bottom-0 left-0 h-[2px] w-full bg-info/20 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
      </div>

      {/* Action Suite */}
      <Button
        onClick={handleSave}
        disabled={isLoading}
        className="btn-gold w-full h-16 group relative overflow-hidden"
      >
        {isLoading ? (
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-xs font-mono font-bold uppercase tracking-widest">Committing Sequence...</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs font-mono font-bold uppercase tracking-widest">Authorize Temporal Grid</span>
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-2" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </Button>
    </div>
  );
}
