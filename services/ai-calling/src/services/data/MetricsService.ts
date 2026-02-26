import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logging/structured-logger';

export interface CallMetric {
    clinic_id: string;
    call_id: string;
    duration_ms: number;
    success: boolean;
    category?: string;
}

export class MetricsService {
    private logger = logger.child({ module: 'MetricsService' });

    /**
     * Log a call metric to the database
     */
    async logCallMetric(metric: CallMetric): Promise<void> {
        const { error } = await supabase
            .from('call_metrics')
            .insert({
                clinic_id: metric.clinic_id,
                call_id: metric.call_id,
                duration_ms: metric.duration_ms,
                success: metric.success,
                category: metric.category,
                created_at: new Date().toISOString()
            });

        if (error) {
            this.logger.error('Failed to log call metric', { error: error.message, metric });
        }
    }

    /**
     * Track latency for a specific operation
     */
    async trackLatency(clinicId: string, operation: string, latencyMs: number): Promise<void> {
        // For now, just log it. In the future, send to Prometheus/Grafana or a DB table.
        this.logger.info('Latency Metric', {
            clinicId,
            operation,
            latencyMs,
            industrial_tag: 'LATENCY_TRACKER'
        });
    }
}

export const metricsService = new MetricsService();
