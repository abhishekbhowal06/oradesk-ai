import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/hooks/use-toast';

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'rescheduled' | 'completed' | 'missed' | 'cancelled';

export interface Appointment {
  id: string;
  clinic_id: string;
  patient_id: string;
  scheduled_at: string;
  duration_minutes: number;
  procedure_name: string;
  status: AppointmentStatus;
  ai_managed: boolean;
  notes: string | null;
  conflict_warning: string | null;
  confirmed_at: string | null;
  rescheduled_from: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  patient?: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    email: string | null;
  };
}

export interface CreateAppointmentInput {
  patient_id: string;
  scheduled_at: string;
  duration_minutes?: number;
  procedure_name: string;
  notes?: string | null;
  ai_managed?: boolean;
}

export interface UpdateAppointmentInput {
  scheduled_at?: string;
  duration_minutes?: number;
  procedure_name?: string;
  status?: AppointmentStatus;
  notes?: string | null;
  conflict_warning?: string | null;
}

export function useAppointments(options?: { date?: string; status?: AppointmentStatus }) {
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['appointments', currentClinic?.id, options],
    queryFn: async () => {
      if (!currentClinic) return [];

      let queryBuilder = supabase
        .from('appointments')
        .select(`
          *,
          patient:patients (
            id,
            first_name,
            last_name,
            phone,
            email
          )
        `)
        .eq('clinic_id', currentClinic.id)
        .order('scheduled_at', { ascending: true });

      if (options?.date) {
        // Filter by date
        const startOfDay = `${options.date}T00:00:00`;
        const endOfDay = `${options.date}T23:59:59`;
        queryBuilder = queryBuilder
          .gte('scheduled_at', startOfDay)
          .lte('scheduled_at', endOfDay);
      }

      if (options?.status) {
        queryBuilder = queryBuilder.eq('status', options.status);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!currentClinic,
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateAppointmentInput) => {
      if (!currentClinic) throw new Error('No clinic selected');

      const { data, error } = await supabase
        .from('appointments')
        .insert({
          ...input,
          clinic_id: currentClinic.id,
          ai_managed: input.ai_managed ?? true,
          duration_minutes: input.duration_minutes ?? 30,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', currentClinic?.id] });
      toast({ title: 'Appointment created', description: 'The appointment has been scheduled.' });
    },
    onError: (error) => {
      console.error('Error creating appointment:', error);
      toast({ title: 'Error', description: 'Failed to create appointment.', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...input }: UpdateAppointmentInput & { id: string }) => {
      const { data, error } = await supabase
        .from('appointments')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', currentClinic?.id] });
      toast({ title: 'Appointment updated', description: 'Changes have been saved.' });
    },
    onError: (error) => {
      console.error('Error updating appointment:', error);
      toast({ title: 'Error', description: 'Failed to update appointment.', variant: 'destructive' });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AppointmentStatus }) => {
      const updates: Partial<Appointment> = { status };
      
      if (status === 'confirmed') {
        updates.confirmed_at = new Date().toISOString();
      }

      const { data, error } = await supabase
        .from('appointments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['appointments', currentClinic?.id] });
      toast({ 
        title: 'Status updated', 
        description: `Appointment marked as ${status}.` 
      });
    },
    onError: (error) => {
      console.error('Error updating status:', error);
      toast({ title: 'Error', description: 'Failed to update status.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('appointments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', currentClinic?.id] });
      toast({ title: 'Appointment deleted', description: 'The appointment has been removed.' });
    },
    onError: (error) => {
      console.error('Error deleting appointment:', error);
      toast({ title: 'Error', description: 'Failed to delete appointment.', variant: 'destructive' });
    },
  });

  return {
    appointments: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createAppointment: createMutation.mutate,
    updateAppointment: updateMutation.mutate,
    updateStatus: updateStatusMutation.mutate,
    deleteAppointment: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export function useTodaysAppointments() {
  const today = new Date().toISOString().split('T')[0];
  return useAppointments({ date: today });
}

export function useUpcomingAppointments(days: number = 7) {
  const { currentClinic } = useClinic();

  return useQuery({
    queryKey: ['appointments', 'upcoming', currentClinic?.id, days],
    queryFn: async () => {
      if (!currentClinic) return [];

      const now = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients (
            id,
            first_name,
            last_name,
            phone,
            email
          )
        `)
        .eq('clinic_id', currentClinic.id)
        .gte('scheduled_at', now.toISOString())
        .lte('scheduled_at', endDate.toISOString())
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!currentClinic,
  });
}
