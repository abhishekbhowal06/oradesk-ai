import client from 'prom-client';

// Enable default metrics (CPU, memory, gc)
client.collectDefaultMetrics({ prefix: 'clinic_os_' });

// Define custom business & operational metrics
export const metrics = {
    callsHandled: new client.Counter({
        name: 'clinic_os_calls_handled_total',
        help: 'Total number of voice calls successfully handled',
        labelNames: ['clinic_id']
    }),

    circuitBreakerTrips: new client.Counter({
        name: 'clinic_os_circuit_breaker_trips_total',
        help: 'Total number of times a circuit breaker was tripped',
        labelNames: ['reason']
    }),

    callLatencyTurnaround: new client.Histogram({
        name: 'clinic_os_call_latency_turnaround_ms',
        help: 'End-to-end latency for a single conversational turn in milliseconds',
        labelNames: ['clinic_id'],
        buckets: [100, 300, 500, 800, 1000, 2000, 5000] // Focus around our 500ms target
    }),

    campaignJobsQueued: new client.Counter({
        name: 'clinic_os_campaign_jobs_queued_total',
        help: 'Total outbound campaign jobs queued into pg-boss',
        labelNames: ['clinic_id', 'call_type']
    }),

    piiRedactionsApplied: new client.Counter({
        name: 'clinic_os_pii_redactions_total',
        help: 'Total PII redactions applied before external API calls or logging',
        labelNames: ['type']
    }),

    emergencyHardStops: new client.Counter({
        name: 'clinic_os_emergency_hard_stops_total',
        help: 'Total medical emergency hard stops triggered by the ToolOrchestrator',
        labelNames: ['clinic_id']
    }),

    bargeInTruncations: new client.Counter({
        name: 'clinic_os_barge_in_truncations_total',
        help: 'Total VAD barge-in truncations during active AI speech',
        labelNames: ['clinic_id']
    }),
};

// Export the registry to be mounted by Express
export const metricsRegistry = client.register;
