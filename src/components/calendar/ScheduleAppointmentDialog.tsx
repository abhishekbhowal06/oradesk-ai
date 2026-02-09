import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Calendar, Clock, User, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePatients } from '@/hooks/usePatients';
import { useAppointments, CreateAppointmentInput } from '@/hooks/useAppointments';
import { LoadingState } from '@/components/states/LoadingState';

interface ScheduleAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string; // ISO date string YYYY-MM-DD
  selectedTime: string; // HH:mm format
}

const PROCEDURES = [
  'Routine Checkup',
  'Teeth Cleaning',
  'Cavity Filling',
  'Root Canal',
  'Tooth Extraction',
  'Dental Crown',
  'Teeth Whitening',
  'Dental Implant',
  'Orthodontic Consultation',
  'Emergency Visit',
];

const DURATIONS = [
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '1 hour' },
  { value: '90', label: '1.5 hours' },
  { value: '120', label: '2 hours' },
];

export function ScheduleAppointmentDialog({
  open,
  onOpenChange,
  selectedDate,
  selectedTime,
}: ScheduleAppointmentDialogProps) {
  const { patients, isLoading: patientsLoading } = usePatients();
  const { createAppointment, isCreating } = useAppointments();

  const [patientId, setPatientId] = useState('');
  const [procedure, setProcedure] = useState('');
  const [duration, setDuration] = useState('30');
  const [notes, setNotes] = useState('');

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setPatientId('');
      setProcedure('');
      setDuration('30');
      setNotes('');
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!patientId || !procedure) return;

    const scheduledAt = `${selectedDate}T${selectedTime}:00`;

    const input: CreateAppointmentInput = {
      patient_id: patientId,
      scheduled_at: scheduledAt,
      procedure_name: procedure,
      duration_minutes: parseInt(duration, 10),
      notes: notes || null,
      ai_managed: true,
    };

    createAppointment(input, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  const formattedDate = selectedDate
    ? format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Schedule Appointment
          </DialogTitle>
          <DialogDescription>
            Book a new appointment for {formattedDate} at {selectedTime}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Patient Selection */}
          <div className="space-y-2">
            <Label htmlFor="patient" className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Patient
            </Label>
            {patientsLoading ? (
              <LoadingState variant="inline" />
            ) : patients.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No patients found. Please add a patient first.
              </p>
            ) : (
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger id="patient">
                  <SelectValue placeholder="Select a patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((patient) => (
                    <SelectItem key={patient.id} value={patient.id}>
                      {patient.first_name} {patient.last_name} — {patient.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Procedure Selection */}
          <div className="space-y-2">
            <Label htmlFor="procedure" className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Procedure
            </Label>
            <Select value={procedure} onValueChange={setProcedure}>
              <SelectTrigger id="procedure">
                <SelectValue placeholder="Select procedure type" />
              </SelectTrigger>
              <SelectContent>
                {PROCEDURES.map((proc) => (
                  <SelectItem key={proc} value={proc}>
                    {proc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration" className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Duration
            </Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger id="duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any special instructions or notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!patientId || !procedure || isCreating}
              className="bg-primary hover:bg-primary/90"
            >
              {isCreating ? 'Scheduling...' : 'Schedule Appointment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
