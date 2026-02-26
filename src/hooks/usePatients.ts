import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useClinic } from '@/contexts/ClinicContext';
import { useToast } from '@/hooks/use-toast';

export interface Patient {
  id: string;
  clinic_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  date_of_birth: string | null;
  notes: string | null;
  status: 'active' | 'inactive' | 'unreachable';
  last_visit: string | null;
  created_at: string;
  updated_at: string;
}

export type CreatePatientInput = Omit<Patient, 'id' | 'clinic_id' | 'created_at' | 'updated_at'>;
export type UpdatePatientInput = Partial<CreatePatientInput>;

export function usePatients(options?: {
  search?: string;
  status?: 'active' | 'inactive' | 'unreachable' | 'all';
}) {
  const { currentClinic } = useClinic();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['patients', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic) return [];

      let queryBuilder = supabase
        .from('patients')
        .select('*')
        .eq('clinic_id', currentClinic.id);

      if (options?.status && options.status !== 'all') {
        queryBuilder = queryBuilder.eq('status', options.status);
      }

      if (options?.search) {
        queryBuilder = queryBuilder.or(`first_name.ilike.%${options.search}%,last_name.ilike.%${options.search}%,phone.ilike.%${options.search}%`);
      }

      const { data, error } = await queryBuilder.order('last_name', { ascending: true });

      if (error) throw error;
      return data as Patient[];
    },
    enabled: !!currentClinic,
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreatePatientInput) => {
      if (!currentClinic) throw new Error('No clinic selected');

      const { data, error } = await supabase
        .from('patients')
        .insert({
          ...input,
          clinic_id: currentClinic.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients', currentClinic?.id] });
      toast({ title: 'Patient created', description: 'The patient has been added successfully.' });
    },
    onError: (error) => {
      console.error('Error creating patient:', error);
      toast({ title: 'Error', description: 'Failed to create patient.', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...input }: UpdatePatientInput & { id: string }) => {
      const { data, error } = await supabase
        .from('patients')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients', currentClinic?.id] });
      toast({ title: 'Patient updated', description: 'Changes have been saved.' });
    },
    onError: (error) => {
      console.error('Error updating patient:', error);
      toast({ title: 'Error', description: 'Failed to update patient.', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('patients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients', currentClinic?.id] });
      toast({ title: 'Patient deleted', description: 'The patient has been removed.' });
    },
    onError: (error) => {
      console.error('Error deleting patient:', error);
      toast({ title: 'Error', description: 'Failed to delete patient.', variant: 'destructive' });
    },
  });

  return {
    patients: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    createPatient: createMutation.mutate,
    updatePatient: updateMutation.mutate,
    deletePatient: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: ['patient', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data as Patient | null;
    },
    enabled: !!id,
  });
}
