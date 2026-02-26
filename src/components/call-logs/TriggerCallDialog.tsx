/**
 * TRIGGER CALL DIALOG
 *
 * Opens a dialog allowing staff to initiate an AI outbound call.
 * Sends POST /v1/calls/outbound to the backend with the user's JWT.
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useClinic } from '@/contexts/ClinicContext';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Phone, Loader2 } from 'lucide-react';

type CallType = 'confirmation' | 'reminder' | 'follow_up' | 'recall';

interface OutboundCallResponse {
  message: string;
  callId: string;
  twilioSid: string;
}

interface TriggerCallDialogProps {
  /** Optional pre-filled patient ID (e.g. from a patient detail page) */
  patientId?: string;
  /** Optional pre-filled appointment ID */
  appointmentId?: string;
}

export function TriggerCallDialog({ patientId, appointmentId }: TriggerCallDialogProps) {
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [callType, setCallType] = useState<CallType>('confirmation');
  const [inputPatientId, setInputPatientId] = useState(patientId || '');
  const [inputAppointmentId, setInputAppointmentId] = useState(appointmentId || '');

  const handleTriggerCall = async () => {
    if (!currentClinic) {
      toast({
        title: 'No Clinic Selected',
        description: 'Please select a clinic before initiating a call.',
        variant: 'destructive',
      });
      return;
    }

    if (!inputPatientId && !inputAppointmentId) {
      toast({
        title: 'Missing Information',
        description: 'Please provide either a Patient ID or Appointment ID.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const payload: Record<string, unknown> = {
      clinic_id: currentClinic.id,
      call_type: callType,
    };

    if (inputAppointmentId) {
      payload.appointment_id = inputAppointmentId;
    }
    if (inputPatientId) {
      payload.patient_id = inputPatientId;
    }

    const { data, error, status } = await apiClient.post<OutboundCallResponse>(
      '/v1/calls/outbound',
      payload,
    );

    setLoading(false);

    if (error) {
      toast({
        title: status === 401 ? 'Authentication Failed' : 'Call Failed',
        description: error,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: '📞 Call Initiated',
      description: `Call queued successfully. ID: ${data?.callId || 'unknown'}`,
    });

    // Refresh call logs
    queryClient.invalidateQueries({ queryKey: ['ai_calls'] });
    setOpen(false);

    // Reset form
    setInputPatientId(patientId || '');
    setInputAppointmentId(appointmentId || '');
    setCallType('confirmation');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Phone className="h-4 w-4" />
          New AI Call
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Trigger AI Outbound Call</DialogTitle>
          <DialogDescription>
            Initiate an AI-powered call to a patient. The AI will handle the conversation using your
            clinic's configured scripts and safety protocols.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Appointment ID */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="appointmentId">
              Appointment ID
            </label>
            <Input
              id="appointmentId"
              placeholder="UUID of the appointment (optional if patient ID is set)"
              value={inputAppointmentId}
              onChange={(e) => setInputAppointmentId(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Patient ID */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground" htmlFor="patientId">
              Patient ID
            </label>
            <Input
              id="patientId"
              placeholder="UUID of the patient (optional if appointment ID is set)"
              value={inputPatientId}
              onChange={(e) => setInputPatientId(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Call Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Call Type</label>
            <Select
              value={callType}
              onValueChange={(val) => setCallType(val as CallType)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select call type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confirmation">Appointment Confirmation</SelectItem>
                <SelectItem value="reminder">Reminder</SelectItem>
                <SelectItem value="follow_up">Follow-Up</SelectItem>
                <SelectItem value="recall">Recall / Reactivation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Info Note */}
          <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            The system will verify patient consent, check your billing quota, and apply all safety
            protocols before the call is placed.
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={loading}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            onClick={handleTriggerCall}
            disabled={loading || (!inputPatientId && !inputAppointmentId)}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Initiating...
              </>
            ) : (
              <>
                <Phone className="h-4 w-4" />
                Trigger Call
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
