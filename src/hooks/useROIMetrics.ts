import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useClinic } from '@/contexts/ClinicContext';

// ── Types ─────────────────────────────────────────────────────
export interface ClinicROIMetrics {
    // Call Performance
    totalCalls30d: number;
    completedCalls30d: number;
    callSuccessRate: number;
    totalCallMinutes: number;

    // Booking Impact
    appointmentsBooked30d: number;
    missedAppointments30d: number;
    recoveredNoShows: number;

    // Financial
    estimatedRevenue30d: number;
    confirmedRevenue30d: number;
    revenueImpact30d: number;

    // Operational
    pendingTasks: number;
    staffHoursSaved: number;

    // Meta
    clinicId: string;
    periodStart: string;
    periodEnd: string;
    generatedAt: string;
}

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

async function fetchROIMetrics(clinicId: string): Promise<ClinicROIMetrics> {
    const { data: { session } } = await supabase.auth.getSession();

    const res = await fetch(
        `${BACKEND_URL}/v1/analytics/roi?clinic_id=${clinicId}`,
        {
            headers: {
                'Content-Type': 'application/json',
                ...(session?.access_token
                    ? { Authorization: `Bearer ${session.access_token}` }
                    : {}),
            },
        }
    );

    if (!res.ok) {
        throw new Error(`ROI fetch failed: ${res.status}`);
    }

    return res.json();
}

// ── Hook ──────────────────────────────────────────────────────
export function useROIMetrics() {
    const { currentClinic } = useClinic();
    const clinicId = currentClinic?.id;

    return useQuery<ClinicROIMetrics>({
        queryKey: ['roi-metrics', clinicId],
        queryFn: () => fetchROIMetrics(clinicId!),
        enabled: !!clinicId,
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes
        refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 min
        retry: 1,
    });
}
