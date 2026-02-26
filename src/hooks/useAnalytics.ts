import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useClinic } from '@/contexts/ClinicContext';

export interface DashboardStats {
  revenueSaved: number;
  callsHandled: number;
  missedPrevented: number;
  confirmationRate: number;
  upcomingToday: number;
  actionRequired: number;
}

export interface WeeklyStats {
  day: string;
  revenue: number;
  calls: number;
  appointments: number;
}

export function useDashboardStats() {
  const { currentClinic } = useClinic();

  return useQuery({
    queryKey: ['dashboard_stats', currentClinic?.id],
    queryFn: async (): Promise<DashboardStats> => {
      if (!currentClinic) {
        return {
          revenueSaved: 0,
          callsHandled: 0,
          missedPrevented: 0,
          confirmationRate: 0,
          upcomingToday: 0,
          actionRequired: 0,
        };
      }

      // Get today's date range
      const today = new Date();
      const startOfDay = new Date(today.setHours(0, 0, 0, 0)).toISOString();
      const endOfDay = new Date(today.setHours(23, 59, 59, 999)).toISOString();

      // Get last 30 days for stats
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Parallel queries for efficiency
      const [
        { data: calls },
        { data: todayAppointments },
        { data: escalatedCalls },
        { data: analytics },
      ] = await Promise.all([
        // AI calls stats
        supabase
          .from('ai_calls')
          .select('id, outcome, revenue_impact')
          .eq('clinic_id', currentClinic.id)
          .gte('created_at', thirtyDaysAgo.toISOString()),

        // Today's appointments
        supabase
          .from('appointments')
          .select('id')
          .eq('clinic_id', currentClinic.id)
          .gte('scheduled_at', startOfDay)
          .lte('scheduled_at', endOfDay),

        // Escalated calls needing action
        supabase
          .from('ai_calls')
          .select('id')
          .eq('clinic_id', currentClinic.id)
          .eq('outcome', 'action_needed')
          .eq('escalation_required', true),

        // Analytics events for revenue
        supabase
          .from('analytics_events')
          .select('id, revenue_impact')
          .eq('clinic_id', currentClinic.id)
          .eq('event_type', 'revenue_saved')
          .gte('created_at', thirtyDaysAgo.toISOString()),
      ]);

      const callsList = calls || [];
      const totalCalls = callsList.length;
      const confirmedCalls = callsList.filter((c) => c.outcome === 'confirmed').length;
      const revenueSaved = callsList.reduce((sum, c) => sum + (Number(c.revenue_impact) || 0), 0);
      const missedPrevented = callsList.filter(
        (c) => c.outcome === 'confirmed' || c.outcome === 'rescheduled',
      ).length;

      return {
        revenueSaved,
        callsHandled: totalCalls,
        missedPrevented,
        confirmationRate: totalCalls > 0 ? Math.round((confirmedCalls / totalCalls) * 100) : 0,
        upcomingToday: todayAppointments?.length || 0,
        actionRequired: escalatedCalls?.length || 0,
      };
    },
    enabled: !!currentClinic,
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useWeeklyStats() {
  const { currentClinic } = useClinic();

  return useQuery({
    queryKey: ['weekly_stats', currentClinic?.id],
    queryFn: async (): Promise<WeeklyStats[]> => {
      if (!currentClinic) return [];

      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const result: WeeklyStats[] = [];

      // Get the last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const startOfDay = new Date(date.setHours(0, 0, 0, 0)).toISOString();
        const endOfDay = new Date(date.setHours(23, 59, 59, 999)).toISOString();

        const [{ data: calls }, { data: appointments }] = await Promise.all([
          supabase
            .from('ai_calls')
            .select('id, revenue_impact')
            .eq('clinic_id', currentClinic.id)
            .gte('created_at', startOfDay)
            .lte('created_at', endOfDay),

          supabase
            .from('appointments')
            .select('id')
            .eq('clinic_id', currentClinic.id)
            .gte('scheduled_at', startOfDay)
            .lte('scheduled_at', endOfDay),
        ]);

        const dayName = days[new Date(date).getDay()];
        const revenue = (calls || []).reduce((sum, c) => sum + (Number(c.revenue_impact) || 0), 0);

        result.push({
          day: dayName,
          revenue,
          calls: calls?.length || 0,
          appointments: appointments?.length || 0,
        });
      }

      return result;
    },
    enabled: !!currentClinic,
  });
}

export type EventType =
  | 'call_initiated'
  | 'call_completed'
  | 'appointment_confirmed'
  | 'appointment_rescheduled'
  | 'appointment_cancelled'
  | 'appointment_missed'
  | 'escalation_created'
  | 'task_created'
  | 'task_completed'
  | 'revenue_saved'
  | 'patient_created'
  | 'staff_action';

export function useAnalyticsEvents(options?: {
  eventType?: EventType;
  limit?: number;
  days?: number;
}) {
  const { currentClinic } = useClinic();

  return useQuery({
    queryKey: ['analytics_events', currentClinic?.id, options],
    queryFn: async () => {
      if (!currentClinic) return [];

      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - (options?.days || 7));

      let queryBuilder = supabase
        .from('analytics_events')
        .select(
          `
          *,
          patient:patients (
            id,
            first_name,
            last_name
          )
        `,
        )
        .eq('clinic_id', currentClinic.id)
        .gte('created_at', daysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (options?.eventType) {
        queryBuilder = queryBuilder.eq('event_type', options.eventType);
      }

      if (options?.limit) {
        queryBuilder = queryBuilder.limit(options.limit);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return data;
    },
    enabled: !!currentClinic,
  });
}

// --- CLINICAL DECISION INTELLIGENCE HOOKS ---

export interface BehavioralInsight {
  id: string;
  patient_id: string;
  detected_urgency: 'emergency' | 'soon' | 'routine' | 'low_priority';
  detected_emotion:
    | 'pain'
    | 'fear'
    | 'price_concern'
    | 'casual'
    | 'frustrated'
    | 'confused'
    | 'angry';
  objection_detected: string;
  ai_response_strategy: string;
  booking_intent_score: number;
  created_at: string;
  patient: {
    first_name: string;
    last_name: string;
  };
}

export function useBehavioralInsights(limit = 20) {
  const { currentClinic } = useClinic();

  return useQuery({
    queryKey: ['behavioral_insights', currentClinic?.id, limit],
    queryFn: async (): Promise<BehavioralInsight[]> => {
      if (!currentClinic) return [];

      const { data, error } = await supabase
        .from('conversation_intent_logs')
        .select(
          `
          *,
          patient:patients (first_name, last_name)
        `,
        )
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as any[];
    },
    enabled: !!currentClinic,
  });
}

export function useStrategicMetrics() {
  const { currentClinic } = useClinic();

  return useQuery({
    queryKey: ['strategic_metrics', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic)
        return {
          avgIntentScore: 0,
          emergencyPriorityRate: 0,
          revenueCaptured: 0,
        };

      const [{ data: intents }, { data: revenue }] = await Promise.all([
        supabase.from('conversation_intent_logs').select('booking_intent_score, detected_urgency'),
        supabase
          .from('revenue_attribution')
          .select('actual_value, estimated_value')
          .eq('status', 'confirmed'),
      ]);

      const scores = intents?.map((i) => i.booking_intent_score) || [];
      const avgIntentScore =
        scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

      const emergencies = intents?.filter((i) => i.detected_urgency === 'emergency').length || 0;
      const emergencyPriorityRate = intents?.length ? (emergencies / intents.length) * 100 : 0;

      const revenueCaptured =
        revenue?.reduce((sum, r) => sum + (Number(r.actual_value || r.estimated_value) || 0), 0) ||
        0;

      return {
        avgIntentScore,
        emergencyPriorityRate,
        revenueCaptured,
      };
    },
    enabled: !!currentClinic,
  });
}

export function useLatencyMetrics(limit = 50) {
  const { currentClinic } = useClinic();

  return useQuery({
    queryKey: ['latency_metrics', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic) return [];

      const { data, error } = await supabase
        .from('analytics_events')
        .select('*')
        .eq('clinic_id', currentClinic.id)
        .eq('event_type', 'staff_action')
        // Filter by JSON field 'action' == 'latency_metric'
        .contains('event_data', { action: 'latency_metric' })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
    enabled: !!currentClinic,
    refetchInterval: 5000, // Live updates
  });
}

// Alias for backwards compatibility
export function useAnalytics() {
  const { currentClinic } = useClinic();

  const query = useQuery({
    queryKey: ['analytics', currentClinic?.id],
    queryFn: async () => {
      if (!currentClinic) return [];

      const { data, error } = await supabase
        .from('analytics_events')
        .select('*')
        .eq('clinic_id', currentClinic.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
    enabled: !!currentClinic,
  });

  return {
    analytics: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
