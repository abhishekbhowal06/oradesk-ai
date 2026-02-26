import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/hooks/use-toast';

export type CallStatus =
  | 'queued'
  | 'calling'
  | 'answered'
  | 'voicemail'
  | 'no_answer'
  | 'failed'
  | 'completed';
export type CallOutcome =
  | 'confirmed'
  | 'rescheduled'
  | 'cancelled'
  | 'action_needed'
  | 'unreachable';

export interface TranscriptMessage {
  role: 'ai' | 'patient';
  message: string;
  timestamp: string;
}

export interface AICall {
  id: string;
  clinic_id: string;
  appointment_id: string | null;
  patient_id: string;
  phone_number: string;
  call_type: 'confirmation' | 'reminder' | 'follow_up' | 'rescheduling';
  status: CallStatus;
  outcome: CallOutcome | null;
  duration_seconds: number | null;
  transcript: TranscriptMessage[] | null;
  confidence_score: number | null;
  ai_reasoning: string | null;
  escalation_required: boolean;
  escalation_reason: string | null;
  model_version: string | null;
  processing_time_ms: number | null;
  revenue_impact: number | null;
  external_call_id: string | null;
  call_started_at: string | null;
  call_ended_at: string | null;
  recording_url: string | null;
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
  };
}

export function useAICalls(options?: {
  status?: CallStatus;
  outcome?: CallOutcome;
  limit?: number;
}) {
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ai_calls', currentClinic?.id, options],
    queryFn: async () => {
      if (!currentClinic) return [];

      let queryBuilder = supabase
        .from('ai_calls')
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
            procedure_name
          )
        `,
        )
        .eq('clinic_id', currentClinic.id)
        .order('created_at', { ascending: false });

      if (options?.status) {
        queryBuilder = queryBuilder.eq('status', options.status);
      }

      if (options?.outcome) {
        queryBuilder = queryBuilder.eq('outcome', options.outcome);
      }

      if (options?.limit) {
        queryBuilder = queryBuilder.limit(options.limit);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      // Parse transcript field from JSON
      return (data || []).map((call: any) => ({
        ...call,
        transcript: call.transcript as TranscriptMessage[] | null,
      })) as AICall[];
    },
    enabled: !!currentClinic,
  });

  // ── Real-Time: auto-refresh when ai_calls rows change ──
  useEffect(() => {
    if (!currentClinic?.id) return;

    const channel = supabase
      .channel('ai-calls-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_calls',
          filter: `clinic_id=eq.${currentClinic.id}`,
        },
        () => {
          // Invalidate + refetch when any call row changes
          queryClient.invalidateQueries({ queryKey: ['ai_calls', currentClinic.id] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentClinic?.id, queryClient]);

  // Convert an AI call escalation to a staff task
  const createTaskFromCallMutation = useMutation({
    mutationFn: async ({
      callId,
      title,
      description,
      priority,
    }: {
      callId: string;
      title: string;
      description: string;
      priority?: 'low' | 'medium' | 'high' | 'urgent';
    }) => {
      if (!currentClinic) throw new Error('No clinic selected');

      // Get the call to link patient and appointment
      const { data: call, error: callError } = await supabase
        .from('ai_calls')
        .select('patient_id, appointment_id')
        .eq('id', callId)
        .single();

      if (callError) throw callError;

      const { data, error } = await supabase
        .from('staff_tasks')
        .insert({
          clinic_id: currentClinic.id,
          ai_call_id: callId,
          patient_id: call.patient_id,
          appointment_id: call.appointment_id,
          title,
          description,
          priority: priority ?? 'high',
          ai_generated: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai_calls', currentClinic?.id] });
      queryClient.invalidateQueries({ queryKey: ['staff_tasks', currentClinic?.id] });
      toast({
        title: 'Task created',
        description: 'A staff task has been created from this call.',
      });
    },
    onError: (error) => {
      console.error('Error creating task:', error);
      toast({ title: 'Error', description: 'Failed to create task.', variant: 'destructive' });
    },
  });

  // Update call outcome/status
  const updateCallMutation = useMutation({
    mutationFn: async ({
      callId,
      updates,
    }: {
      callId: string;
      updates: {
        status?: CallStatus;
        outcome?: CallOutcome | null;
        escalation_required?: boolean;
        escalation_reason?: string | null;
        call_ended_at?: string;
      };
    }) => {
      const { data, error } = await supabase
        .from('ai_calls')
        .update(updates)
        .eq('id', callId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai_calls', currentClinic?.id] });
    },
    onError: (error) => {
      console.error('Error updating call:', error);
      toast({ title: 'Error', description: 'Failed to update call.', variant: 'destructive' });
    },
  });

  return {
    calls: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createTaskFromCall: createTaskFromCallMutation.mutate,
    updateCall: updateCallMutation.mutate,
    isCreatingTask: createTaskFromCallMutation.isPending,
    isUpdatingCall: updateCallMutation.isPending,
  };
}

export function useRecentCalls(limit: number = 5) {
  const { currentClinic } = useClinic();

  return useQuery({
    queryKey: ['ai_calls', 'recent', currentClinic?.id, limit],
    queryFn: async () => {
      if (!currentClinic) return [];

      const { data, error } = await supabase
        .from('ai_calls')
        .select(
          `
          *,
          patient:patients (
            id,
            first_name,
            last_name,
            phone
          )
        `,
        )
        .eq('clinic_id', currentClinic.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []).map((call: any) => ({
        ...call,
        transcript: call.transcript as TranscriptMessage[] | null,
      })) as AICall[];
    },
    enabled: !!currentClinic,
  });
}

export function useEscalatedCalls() {
  const { currentClinic } = useClinic();

  return useQuery({
    queryKey: ['ai_calls', 'escalated', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic) return [];

      const { data, error } = await supabase
        .from('ai_calls')
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
            procedure_name
          )
        `,
        )
        .eq('clinic_id', currentClinic.id)
        .eq('escalation_required', true)
        .eq('outcome', 'action_needed')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((call: any) => ({
        ...call,
        transcript: call.transcript as TranscriptMessage[] | null,
      })) as AICall[];
    },
    enabled: !!currentClinic,
  });
}

export function useCallStats() {
  const { currentClinic } = useClinic();

  return useQuery({
    queryKey: ['ai_calls', 'stats', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic) return null;

      // Get calls from the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data, error } = await supabase
        .from('ai_calls')
        .select('id, outcome, revenue_impact, duration_seconds, status')
        .eq('clinic_id', currentClinic.id)
        .gte('created_at', sevenDaysAgo.toISOString());

      if (error) throw error;

      const calls = data || [];
      const totalCalls = calls.length;
      const confirmedCalls = calls.filter((c) => c.outcome === 'confirmed').length;
      const revenueSaved = calls.reduce((sum, c) => sum + (Number(c.revenue_impact) || 0), 0);
      const avgDuration =
        calls.length > 0
          ? calls.reduce((sum, c) => sum + (c.duration_seconds || 0), 0) / calls.length
          : 0;
      const escalatedCalls = calls.filter((c) => c.outcome === 'action_needed').length;

      return {
        totalCalls,
        confirmedCalls,
        confirmationRate: totalCalls > 0 ? Math.round((confirmedCalls / totalCalls) * 100) : 0,
        revenueSaved,
        avgDuration: Math.round(avgDuration),
        escalatedCalls,
      };
    },
    enabled: !!currentClinic,
  });
}
