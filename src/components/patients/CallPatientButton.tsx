import { useState } from 'react';
import { Phone, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface CallPatientButtonProps {
  patientId: string;
  patientName: string;
  phoneNumber: string;
  appointmentId?: string;
  callType?: 'confirmation' | 'reminder' | 'follow_up';
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function CallPatientButton({
  patientId,
  patientName,
  phoneNumber,
  appointmentId,
  callType = 'confirmation',
  variant = 'outline',
  size = 'sm',
}: CallPatientButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const initiateCall = async () => {
    if (!currentClinic) {
      toast({
        title: 'Error',
        description: 'No clinic selected',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setIsOpen(false);

    try {
      const { data, error } = await supabase.functions.invoke('twilio-call', {
        body: {
          action: 'initiate',
          patientId,
          appointmentId,
          clinicId: currentClinic.id,
          phoneNumber,
          callType,
        },
      });

      if (error) throw error;

      if (data.configured === false) {
        toast({
          title: 'Twilio Not Configured',
          description: 'Please configure Twilio credentials in your settings.',
          variant: 'destructive',
        });
        return;
      }

      if (data.success) {
        toast({
          title: 'Call Initiated',
          description: `AI is now calling ${patientName}. Check Call Logs for status.`,
        });

        // Invalidate queries to refresh call logs
        queryClient.invalidateQueries({ queryKey: ['ai_calls'] });
      } else {
        throw new Error(data.error || 'Failed to initiate call');
      }
    } catch (error) {
      console.error('Error initiating call:', error);
      toast({
        title: 'Call Failed',
        description: error instanceof Error ? error.message : 'Failed to initiate call',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} disabled={isLoading} className="gap-2">
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
          {size !== 'icon' && (isLoading ? 'Calling...' : 'Call Patient')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="glass-card border-white/10">
        <AlertDialogHeader>
          <AlertDialogTitle>Initiate AI Call</AlertDialogTitle>
          <AlertDialogDescription>
            The AI assistant will call <strong>{patientName}</strong> at{' '}
            <strong>{phoneNumber}</strong> for appointment{' '}
            {callType === 'confirmation' ? 'confirmation' : callType}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={initiateCall} className="btn-gold">
            Start Call
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
