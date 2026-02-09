import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, ArrowRight, Loader2 } from 'lucide-react';
import { WorkingHours } from '@/contexts/ClinicContext';

interface StepHoursProps {
  workingHours: WorkingHours;
  onSave: (hours: WorkingHours, callDuringHoursOnly: boolean) => Promise<void>;
  isLoading: boolean;
}

const DAYS = [
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
];

const TIME_OPTIONS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00',
];

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

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
    setWorkingDays(prev => ({ ...prev, [day]: !prev[day] }));
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
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            When should we answer calls?
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          We'll handle patient calls during your clinic hours
        </p>
      </div>

      {/* Time Pickers */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="text-foreground">Clinic opens at</Label>
          <Select value={openTime} onValueChange={setOpenTime}>
            <SelectTrigger className="bg-background/50 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map((time) => (
                <SelectItem key={time} value={time}>
                  {formatTime(time)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-foreground">Clinic closes at</Label>
          <Select value={closeTime} onValueChange={setCloseTime}>
            <SelectTrigger className="bg-background/50 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map((time) => (
                <SelectItem key={time} value={time}>
                  {formatTime(time)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Working Days */}
      <div className="space-y-3">
        <Label className="text-foreground">Working days</Label>
        <div className="flex flex-wrap gap-3">
          {DAYS.map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-2 cursor-pointer select-none"
            >
              <Checkbox
                checked={workingDays[key]}
                onCheckedChange={() => handleDayToggle(key)}
                className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
              />
              <span className="text-sm text-foreground">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* AI Hours Toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-background/30 border border-white/5">
        <div className="space-y-0.5">
          <Label className="text-foreground font-medium">
            Allow AI calls only during clinic hours
          </Label>
          <p className="text-xs text-muted-foreground">
            Outside these hours, calls will be handled by staff or paused
          </p>
        </div>
        <Switch
          checked={callDuringHoursOnly}
          onCheckedChange={setCallDuringHoursOnly}
        />
      </div>

      {/* CTA */}
      <Button
        onClick={handleSave}
        disabled={isLoading}
        className="btn-gold w-full py-6 text-base"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            Save & Continue
            <ArrowRight className="ml-2 h-5 w-5" />
          </>
        )}
      </Button>
    </div>
  );
}
