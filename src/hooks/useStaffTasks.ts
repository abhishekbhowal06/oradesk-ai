import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useClinic } from '@/contexts/ClinicContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface StaffTask {
  id: string;
  clinic_id: string;
  assigned_to: string | null;
  created_by: string | null;
  appointment_id: string | null;
  patient_id: string | null;
  ai_call_id: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  ai_generated: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  patient?: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
  };
  assigned_profile?: {
    id: string;
    full_name: string | null;
    email: string;
  };
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  assigned_to?: string | null;
  patient_id?: string | null;
  appointment_id?: string | null;
  due_at?: string | null;
}

export function useStaffTasks(options?: { status?: TaskStatus; priority?: TaskPriority }) {
  const { currentClinic } = useClinic();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['staff_tasks', currentClinic?.id, options],
    queryFn: async () => {
      if (!currentClinic) return [];

      let queryBuilder = supabase
        .from('staff_tasks')
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
        .order('created_at', { ascending: false });

      if (options?.status) {
        queryBuilder = queryBuilder.eq('status', options.status);
      }

      if (options?.priority) {
        queryBuilder = queryBuilder.eq('priority', options.priority);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return data as StaffTask[];
    },
    enabled: !!currentClinic,
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      if (!currentClinic) throw new Error('No clinic selected');

      const { data, error } = await supabase
        .from('staff_tasks')
        .insert({
          ...input,
          clinic_id: currentClinic.id,
          created_by: user?.id,
          priority: input.priority ?? 'medium',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_tasks', currentClinic?.id] });
      toast({ title: 'Task created', description: 'The task has been added.' });
    },
    onError: (error) => {
      console.error('Error creating task:', error);
      toast({ title: 'Error', description: 'Failed to create task.', variant: 'destructive' });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TaskStatus }) => {
      const updates: Partial<StaffTask> = { status };

      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
        updates.completed_by = user?.id;
      }

      const { data, error } = await supabase
        .from('staff_tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['staff_tasks', currentClinic?.id] });
      toast({ title: 'Task updated', description: `Task marked as ${status}.` });
    },
    onError: (error) => {
      console.error('Error updating task:', error);
      toast({ title: 'Error', description: 'Failed to update task.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('staff_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_tasks', currentClinic?.id] });
      toast({ title: 'Task deleted', description: 'The task has been removed.' });
    },
    onError: (error) => {
      console.error('Error deleting task:', error);
      toast({ title: 'Error', description: 'Failed to delete task.', variant: 'destructive' });
    },
  });

  return {
    tasks: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createTask: createMutation.mutate,
    updateStatus: updateStatusMutation.mutate,
    deleteTask: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateStatusMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export function usePendingTasks() {
  return useStaffTasks({ status: 'pending' });
}

export function useUrgentTasks() {
  return useStaffTasks({ priority: 'urgent' });
}
