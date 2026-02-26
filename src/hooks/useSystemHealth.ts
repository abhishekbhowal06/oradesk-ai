import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ── Types ─────────────────────────────────────────────────────
export interface SystemHealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    database: {
        connected: boolean;
        error?: string;
    };
    circuitBreakers: {
        twilio: string;
        gemini: string;
        allHealthy: boolean;
    };
    version: string;
}

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

async function fetchSystemHealth(): Promise<SystemHealthStatus> {
    const { data: { session } } = await supabase.auth.getSession();

    const res = await fetch(`${BACKEND_URL}/health/detailed`, {
        headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token
                ? { Authorization: `Bearer ${session.access_token}` }
                : {}),
        },
    });

    if (!res.ok) {
        // If backend is down, return unhealthy status
        return {
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            database: { connected: false, error: `Backend returned ${res.status}` },
            circuitBreakers: { twilio: 'unknown', gemini: 'unknown', allHealthy: false },
            version: 'unknown',
        };
    }

    return res.json();
}

// ── Hook ──────────────────────────────────────────────────────
export function useSystemHealth() {
    return useQuery<SystemHealthStatus>({
        queryKey: ['system-health'],
        queryFn: fetchSystemHealth,
        staleTime: 30 * 1000, // Cache for 30 seconds
        refetchInterval: 60 * 1000, // Auto-refresh every 60s
        retry: 1,
        // Don't throw on error — show degraded state instead
        meta: { errorMessage: 'System health check failed' },
    });
}
