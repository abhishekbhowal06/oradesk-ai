import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/hooks/use-toast';

export type FollowUpStatus = 'pending' | 'in_progress' | 'completed' | 'exhausted' | 'cancelled';

export interface FollowUpSchedule {
  id: string;
  clinic_id: string;
  patient_id: string;
  appointment_id: string;
  scheduled_for: string;
  attempt_number: number;
  max_attempts: number;
  status: FollowUpStatus;
  delay_hours: number;
  last_attempt_at: string | null;
  next_attempt_at: string | null;
  completed_at: string | null;
  failure_reason: string | null;
  related_call_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  patient?: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
  };
  appointment?: {
    id: string;
    scheduled_at: string;
    procedure_name: string;
    status: string;
  };
}

export interface CreateFollowUpInput {
  patient_id: string;
  appointment_id: string;
  scheduled_for: string;
  delay_hours?: number;
  max_attempts?: number;
  related_call_id?: string;
}

export function useFollowUps(options?: { status?: FollowUpStatus }) {
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['follow_up_schedules', currentClinic?.id, options],
    queryFn: async () => {
      if (!currentClinic) return [];

      let queryBuilder = supabase
        .from('follow_up_schedules')
        .select(
          `
          *,
          patient:patients (
            id,
            first_name,
            last_name,
            phone
          ),
          appointment:appointments (
            id,
            scheduled_at,
            procedure_name,
            status
          )
        `,
        )
        .eq('clinic_id', currentClinic.id)
        .order('scheduled_for', { ascending: true });

      if (options?.status) {
        queryBuilder = queryBuilder.eq('status', options.status);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return data as FollowUpSchedule[];
    },
    enabled: !!currentClinic,
  });

  // Create a new follow-up schedule
  const createMutation = useMutation({
    mutationFn: async (input: CreateFollowUpInput) => {
      if (!currentClinic) throw new Error('No clinic selected');

      const { data, error } = await supabase
        .from('follow_up_schedules')
        .insert({
          ...input,
          clinic_id: currentClinic.id,
          delay_hours: input.delay_hours ?? 4,
          max_attempts: input.max_attempts ?? 3,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow_up_schedules', currentClinic?.id] });
      toast({
        title: 'Follow-up scheduled',
        description: 'The follow-up has been added to the queue.',
      });
    },
    onError: (error) => {
      console.error('Error creating follow-up:', error);
      toast({
        title: 'Error',
        description: 'Failed to schedule follow-up.',
        variant: 'destructive',
      });
    },
  });

  // Update follow-up status
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      failure_reason,
    }: {
      id: string;
      status: FollowUpStatus;
      failure_reason?: string;
    }) => {
      const updates: Partial<FollowUpSchedule> = { status };

      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      if (failure_reason) {
        updates.failure_reason = failure_reason;
      }

      const { data, error } = await supabase
        .from('follow_up_schedules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow_up_schedules', currentClinic?.id] });
      toast({ title: 'Follow-up updated', description: 'Status has been changed.' });
    },
    onError: (error) => {
      console.error('Error updating follow-up:', error);
      toast({ title: 'Error', description: 'Failed to update follow-up.', variant: 'destructive' });
    },
  });

  // Increment attempt and reschedule
  const incrementAttemptMutation = useMutation({
    mutationFn: async ({ id, nextAttemptAt }: { id: string; nextAttemptAt: string }) => {
      // First get current attempt number
      const { data: current, error: fetchError } = await supabase
        .from('follow_up_schedules')
        .select('attempt_number, max_attempts')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const newAttemptNumber = (current.attempt_number || 1) + 1;
      const isExhausted = newAttemptNumber > current.max_attempts;

      const updates: Partial<FollowUpSchedule> = {
        attempt_number: newAttemptNumber,
        last_attempt_at: new Date().toISOString(),
        status: isExhausted ? 'exhausted' : 'pending',
        next_attempt_at: isExhausted ? null : nextAttemptAt,
      };

      const { data, error } = await supabase
        .from('follow_up_schedules')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['follow_up_schedules', currentClinic?.id] });

      if (data.status === 'exhausted') {
        toast({
          title: 'Follow-up attempts exhausted',
          description: 'Maximum attempts reached. Manual intervention required.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Attempt recorded',
          description: `Next attempt scheduled for ${new Date(data.next_attempt_at!).toLocaleString()}.`,
        });
      }
    },
    onError: (error) => {
      console.error('Error incrementing attempt:', error);
      toast({ title: 'Error', description: 'Failed to record attempt.', variant: 'destructive' });
    },
  });

  // Cancel a follow-up
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('follow_up_schedules')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow_up_schedules', currentClinic?.id] });
      toast({ title: 'Follow-up cancelled', description: 'The follow-up has been cancelled.' });
    },
    onError: (error) => {
      console.error('Error cancelling follow-up:', error);
      toast({ title: 'Error', description: 'Failed to cancel follow-up.', variant: 'destructive' });
    },
  });

  return {
    followUps: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createFollowUp: createMutation.mutate,
    updateStatus: updateStatusMutation.mutate,
    incrementAttempt: incrementAttemptMutation.mutate,
    cancelFollowUp: cancelMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateStatusMutation.isPending,
  };
}

export function usePendingFollowUps() {
  return useFollowUps({ status: 'pending' });
}

export function useFollowUpStats() {
  const { currentClinic } = useClinic();

  return useQuery({
    queryKey: ['follow_up_schedules', 'stats', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic) return null;

      const { data, error } = await supabase
        .from('follow_up_schedules')
        .select('id, status, attempt_number, max_attempts')
        .eq('clinic_id', currentClinic.id);

      if (error) throw error;

      const followUps = data || [];
      const pending = followUps.filter((f) => f.status === 'pending').length;
      const inProgress = followUps.filter((f) => f.status === 'in_progress').length;
      const completed = followUps.filter((f) => f.status === 'completed').length;
      const exhausted = followUps.filter((f) => f.status === 'exhausted').length;

      return {
        pending,
        inProgress,
        completed,
        exhausted,
        total: followUps.length,
        successRate: followUps.length > 0 ? Math.round((completed / followUps.length) * 100) : 0,
      };
    },
    enabled: !!currentClinic,
  });
}
