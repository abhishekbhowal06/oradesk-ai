import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

const CLINIC_FETCH_TIMEOUT_MS = 5000;

function timeout<T>(ms: number, label: string) {
  return new Promise<T>((_, reject) => {
    window.setTimeout(() => reject(new Error(label)), ms);
  });
}

export interface WorkingHours {
  [key: string]: { start: string; end: string; closed: boolean };
}

export interface AISettings {
  confirmation_calls_enabled: boolean;
  reminder_hours_before: number;
  max_follow_up_attempts: number;
  follow_up_delay_hours: number;
  // Extended settings for full AI control
  auto_reschedule_enabled?: boolean;
  escalate_when_unsure?: boolean;
  follow_up_enabled?: boolean;
  call_during_hours_only?: boolean;
  stop_after_failures?: number;
  auto_escalate_on_failure?: boolean;
  // New AI personality settings
  system_prompt?: string;
  ai_voice_id?: string;
  ai_language?: string;
  ai_tone?: string;
  ai_speed?: number;
  first_message?: string;
}

export interface NotificationSettings {
  email_enabled: boolean;
  sms_enabled: boolean;
  action_required_timing: 'immediate' | 'hourly' | 'daily';
}

interface Clinic {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  timezone: string;
  working_hours: WorkingHours;
  ai_settings: AISettings;
  notification_settings: NotificationSettings;
  twilio_phone_number: string | null;
  onboarding_completed: boolean;
}

// Helper to safely parse JSON fields
function parseClinicData(data: any): Clinic {
  return {
    ...data,
    working_hours: (data.working_hours as WorkingHours) || {},
    ai_settings: (data.ai_settings as AISettings) || {
      confirmation_calls_enabled: true,
      reminder_hours_before: 24,
      max_follow_up_attempts: 3,
      follow_up_delay_hours: 4,
    },
    notification_settings: (data.notification_settings as NotificationSettings) || {
      email_enabled: true,
      sms_enabled: true,
      action_required_timing: 'immediate',
    },
    twilio_phone_number: data.twilio_phone_number || null,
    onboarding_completed: data.onboarding_completed || false,
  };
}

interface StaffMembership {
  id: string;
  clinic_id: string;
  role: 'admin' | 'receptionist';
  is_active: boolean;
  clinic: Clinic;
}

interface ClinicContextType {
  currentClinic: Clinic | null;
  memberships: StaffMembership[];
  isLoading: boolean;
  isUpdating: boolean;
  isAdmin: boolean;
  setCurrentClinic: (clinic: Clinic) => void;
  refreshClinics: () => Promise<void>;
  updateClinicSettings: (settings: Partial<Clinic>) => Promise<void>;
  createClinic: (name: string) => Promise<Clinic | null>;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

export function ClinicProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [currentClinic, setCurrentClinicState] = useState<Clinic | null>(null);
  const [memberships, setMemberships] = useState<StaffMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const lastFetchIdRef = useRef(0);

  const fetchMemberships = useCallback(async () => {
    const fetchId = ++lastFetchIdRef.current;

    if (!user) {
      setMemberships([]);
      setCurrentClinicState(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await Promise.race([
        supabase
          .from('staff_memberships')
          .select(`
            id,
            clinic_id,
            role,
            is_active,
            clinic:clinics (
              id,
              name,
              phone,
              email,
              address,
              timezone,
              working_hours,
              ai_settings,
              notification_settings
            )
          `)
          .eq('user_id', user.id)
          .eq('is_active', true),
        timeout<any>(CLINIC_FETCH_TIMEOUT_MS, 'Clinic membership fetch timeout'),
      ]);

      // Ignore stale responses
      if (fetchId !== lastFetchIdRef.current) return;

      if (error) {
        console.warn('[clinic] Error fetching memberships:', error);
        setMemberships([]);
        setCurrentClinicState(null);
        setIsLoading(false);
        return;
      }

      // Transform the data - filter out any with null clinic (shouldn't happen but be safe)
      const transformedMemberships: StaffMembership[] = (data || [])
        .filter((m: any) => m.clinic !== null)
        .map((m: any) => ({
          id: m.id,
          clinic_id: m.clinic_id,
          role: m.role,
          is_active: m.is_active,
          clinic: parseClinicData(m.clinic),
        }));

      setMemberships(transformedMemberships);

      // Set current clinic to first one if not set
      if (transformedMemberships.length > 0) {
        setCurrentClinicState(prev => prev ? prev : transformedMemberships[0].clinic);
      } else {
        setCurrentClinicState(null);
      }
    } catch (error) {
      if (fetchId !== lastFetchIdRef.current) return;
      console.warn('[clinic] Membership fetch failed (non-blocking):', error);
      setMemberships([]);
      setCurrentClinicState(null);
    } finally {
      if (fetchId !== lastFetchIdRef.current) return;
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMemberships();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, fetchMemberships]);

  const setCurrentClinic = useCallback((clinic: Clinic) => {
    setCurrentClinicState(clinic);
    localStorage.setItem('dentacor_current_clinic', clinic.id);
  }, []);

  const refreshClinics = useCallback(async () => {
    await fetchMemberships();
  }, [fetchMemberships]);

  const updateClinicSettings = useCallback(async (settings: Partial<Clinic>) => {
    if (!currentClinic) return;

    setIsUpdating(true);
    try {
      // Convert to JSON-compatible format for Supabase
      const updateData: Record<string, unknown> = { ...settings };
      const { error } = await supabase
        .from('clinics')
        .update(updateData)
        .eq('id', currentClinic.id);

      if (error) throw error;

      setCurrentClinicState(prev => prev ? { ...prev, ...settings } : null);
      
      toast({
        title: 'Settings updated',
        description: 'Your clinic settings have been saved.',
      });
    } catch (error) {
      console.error('Error updating clinic:', error);
      toast({
        title: 'Error',
        description: 'Failed to update settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  }, [currentClinic, toast]);

  const createClinic = useCallback(async (name: string): Promise<Clinic | null> => {
    if (!user) return null;

    try {
      // Use RPC function to create clinic + add user as admin atomically
      const { data: clinicId, error: rpcError } = await supabase.rpc(
        'create_clinic_with_admin',
        { clinic_name: name }
      );

      if (rpcError) throw rpcError;
      if (!clinicId) throw new Error('Clinic ID not returned');

      // Refresh memberships (SELECT policy now satisfied since user is a member)
      await refreshClinics();

      // Fetch the newly created clinic directly to return it (avoid stale closure)
      const { data: newClinic, error: fetchError } = await supabase
        .from('clinics')
        .select('*')
        .eq('id', clinicId)
        .single();

      if (fetchError || !newClinic) {
        console.warn('[clinic] Could not fetch new clinic after creation');
      } else {
        // Set as current clinic
        setCurrentClinicState(parseClinicData(newClinic));
      }

      toast({
        title: 'Clinic created',
        description: `${name} has been created successfully.`,
      });

      // Return the parsed clinic
      return newClinic ? parseClinicData(newClinic) : null;
    } catch (error) {
      console.error('[clinic] Error creating clinic:', error);
      toast({
        title: 'Error',
        description: 'Failed to create clinic. Please try again.',
        variant: 'destructive',
      });
      return null;
    }
  }, [user, refreshClinics, toast]);

  const isAdmin = memberships.find(m => m.clinic_id === currentClinic?.id)?.role === 'admin';

  return (
    <ClinicContext.Provider
      value={{
        currentClinic,
        memberships,
        isLoading,
        isUpdating,
        isAdmin,
        setCurrentClinic,
        refreshClinics,
        updateClinicSettings,
        createClinic,
      }}
    >
      {children}
    </ClinicContext.Provider>
  );
}

export function useClinic() {
  const context = useContext(ClinicContext);
  if (context === undefined) {
    throw new Error('useClinic must be used within a ClinicProvider');
  }
  return context;
}
