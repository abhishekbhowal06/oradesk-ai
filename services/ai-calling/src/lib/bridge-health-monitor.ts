/**
 * ORADESK AI — BRIDGE HEALTH MONITORING
 * ═══════════════════════════════════════════════════════════
 *
 * Production-grade health monitoring for the PMS Bridge subsystem.
 *
 * Monitors:
 *   1. Device heartbeat freshness
 *   2. Sync lag detection (stale data)
 *   3. Write queue backlog & failure rate
 *   4. Consecutive failure escalation
 *   5. Token expiry warnings
 *   6. Entity map integrity checks
 *
 * Integrates with:
 *   - Prometheus metrics (/metrics)
 *   - Operations reliability (auto-recovery)
 *   - Staff alert system
 *   - Email/webhook alert dispatch
 */

import { supabase } from '../lib/supabase';
import { logger } from '../lib/logging/structured-logger';
import { metrics as existingMetrics, metricsRegistry } from '../lib/metrics';
import client from 'prom-client';

// ─── Prometheus Metrics ─────────────────────────────────────

export const bridgeMetrics = {
    heartbeatAge: new client.Gauge({
        name: 'oradesk_bridge_heartbeat_age_seconds',
        help: 'Seconds since last bridge heartbeat',
        labelNames: ['clinic_id'],
    }),

    syncLag: new client.Gauge({
        name: 'oradesk_bridge_sync_lag_seconds',
        help: 'Seconds since last successful sync',
        labelNames: ['clinic_id', 'direction'],
    }),

    writeQueueDepth: new client.Gauge({
        name: 'oradesk_bridge_write_queue_depth',
        help: 'Number of pending write commands',
        labelNames: ['clinic_id', 'status'],
    }),

    writeFailureRate: new client.Gauge({
        name: 'oradesk_bridge_write_failure_rate',
        help: 'Percentage of writes that failed in last hour',
        labelNames: ['clinic_id'],
    }),

    syncedRecords: new client.Counter({
        name: 'oradesk_bridge_synced_records_total',
        help: 'Total records synced from PMS',
        labelNames: ['clinic_id', 'entity_type'],
    }),

    consecutiveFailures: new client.Gauge({
        name: 'oradesk_bridge_consecutive_failures',
        help: 'Current consecutive failure count',
        labelNames: ['clinic_id'],
    }),

    entityMapSize: new client.Gauge({
        name: 'oradesk_bridge_entity_map_size',
        help: 'Total entities in PMS-OraDesk mapping',
        labelNames: ['clinic_id', 'entity_type'],
    }),

    deviceStatus: new client.Gauge({
        name: 'oradesk_bridge_device_status',
        help: 'Device status (1=active, 0=offline, -1=suspended)',
        labelNames: ['clinic_id', 'pms_provider'],
    }),
};

// ─── Health Status Types ────────────────────────────────────

export interface BridgeHealthReport {
    clinicId: string;
    generatedAt: string;
    overallStatus: 'healthy' | 'degraded' | 'critical' | 'disconnected';
    checks: BridgeHealthCheck[];
    alerts: BridgeAlert[];
    metrics: BridgeMetricSnapshot;
}

interface BridgeHealthCheck {
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
    value?: number;
    threshold?: number;
}

export interface BridgeAlert {
    id: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
    clinicId: string;
    triggeredAt: string;
    resolvedAt?: string;
    autoRecover?: boolean;
}

interface BridgeMetricSnapshot {
    heartbeatAgeSec: number;
    syncLagSec: number;
    writeQueuePending: number;
    writeQueueFailed: number;
    writeFailureRate: number;
    totalRecordsSynced: number;
    totalWritesExecuted: number;
    consecutiveFailures: number;
    entityMapSize: number;
}

// ─── Thresholds ─────────────────────────────────────────────

const THRESHOLDS = {
    HEARTBEAT_WARN_SEC: 180,        // 3 min — warn
    HEARTBEAT_CRITICAL_SEC: 600,    // 10 min — critical
    SYNC_LAG_WARN_SEC: 300,        // 5 min — warn
    SYNC_LAG_CRITICAL_SEC: 1800,   // 30 min — critical
    WRITE_QUEUE_WARN: 10,          // 10 pending writes
    WRITE_QUEUE_CRITICAL: 50,      // 50 pending writes
    WRITE_FAILURE_RATE_WARN: 0.2,  // 20% failure rate
    WRITE_FAILURE_RATE_CRITICAL: 0.5, // 50% failure rate
    CONSECUTIVE_FAILURE_WARN: 3,
    CONSECUTIVE_FAILURE_CRITICAL: 5,   // Auto-disable threshold
};

// ═══════════════════════════════════════════════════════════
// HEALTH CHECK ENGINE
// ═══════════════════════════════════════════════════════════

/**
 * Generate a comprehensive health report for a clinic's bridge.
 */
export async function generateBridgeHealthReport(clinicId: string): Promise<BridgeHealthReport> {
    const checks: BridgeHealthCheck[] = [];
    const alerts: BridgeAlert[] = [];
    const now = Date.now();

    // ── 1. Device Status ──
    const { data: device } = await supabase
        .from('bridge_devices')
        .select('*')
        .eq('clinic_id', clinicId)
        .single();

    if (!device) {
        return {
            clinicId,
            generatedAt: new Date().toISOString(),
            overallStatus: 'disconnected',
            checks: [{ name: 'device_registered', status: 'fail', message: 'No bridge device registered' }],
            alerts: [],
            metrics: emptyMetrics(),
        };
    }

    // ── 2. Heartbeat Freshness ──
    const heartbeatAgeSec = device.last_heartbeat_at
        ? Math.floor((now - new Date(device.last_heartbeat_at).getTime()) / 1000)
        : Infinity;

    bridgeMetrics.heartbeatAge.set({ clinic_id: clinicId }, heartbeatAgeSec);

    if (heartbeatAgeSec > THRESHOLDS.HEARTBEAT_CRITICAL_SEC) {
        checks.push({ name: 'heartbeat', status: 'fail', message: `No heartbeat for ${Math.floor(heartbeatAgeSec / 60)} minutes`, value: heartbeatAgeSec, threshold: THRESHOLDS.HEARTBEAT_CRITICAL_SEC });
        alerts.push(createAlert(clinicId, 'critical', 'Bridge Offline', `PMS Bridge has not responded for ${Math.floor(heartbeatAgeSec / 60)} minutes. Data sync is paused.`));
    } else if (heartbeatAgeSec > THRESHOLDS.HEARTBEAT_WARN_SEC) {
        checks.push({ name: 'heartbeat', status: 'warn', message: `Heartbeat delayed: ${heartbeatAgeSec}s`, value: heartbeatAgeSec, threshold: THRESHOLDS.HEARTBEAT_WARN_SEC });
        alerts.push(createAlert(clinicId, 'warning', 'Bridge Heartbeat Delayed', `PMS Bridge heartbeat is ${Math.floor(heartbeatAgeSec / 60)} minutes late.`));
    } else {
        checks.push({ name: 'heartbeat', status: 'pass', message: `Healthy (${heartbeatAgeSec}s ago)`, value: heartbeatAgeSec });
    }

    // ── 3. Sync Lag ──
    const syncLagSec = device.last_sync_at
        ? Math.floor((now - new Date(device.last_sync_at).getTime()) / 1000)
        : Infinity;

    bridgeMetrics.syncLag.set({ clinic_id: clinicId, direction: 'pms_to_cloud' }, syncLagSec);

    if (syncLagSec > THRESHOLDS.SYNC_LAG_CRITICAL_SEC) {
        checks.push({ name: 'sync_lag', status: 'fail', message: `No sync for ${Math.floor(syncLagSec / 60)} minutes`, value: syncLagSec, threshold: THRESHOLDS.SYNC_LAG_CRITICAL_SEC });
        alerts.push(createAlert(clinicId, 'critical', 'PMS Sync Stale', `Patient and appointment data has not been updated for ${Math.floor(syncLagSec / 60)} minutes.`));
    } else if (syncLagSec > THRESHOLDS.SYNC_LAG_WARN_SEC) {
        checks.push({ name: 'sync_lag', status: 'warn', message: `Sync lag: ${syncLagSec}s`, value: syncLagSec });
    } else {
        checks.push({ name: 'sync_lag', status: 'pass', message: `Current (${syncLagSec}s ago)`, value: syncLagSec });
    }

    // ── 4. Write Queue Depth ──
    const { count: pendingWrites } = await supabase
        .from('pms_write_queue')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .in('status', ['pending', 'claimed', 'executing']);

    const pending = pendingWrites || 0;
    bridgeMetrics.writeQueueDepth.set({ clinic_id: clinicId, status: 'pending' }, pending);

    if (pending > THRESHOLDS.WRITE_QUEUE_CRITICAL) {
        checks.push({ name: 'write_queue', status: 'fail', message: `${pending} writes backed up`, value: pending, threshold: THRESHOLDS.WRITE_QUEUE_CRITICAL });
        alerts.push(createAlert(clinicId, 'critical', 'Write Queue Overloaded', `${pending} appointment write-backs are queued. Bridge may be unable to write to PMS.`));
    } else if (pending > THRESHOLDS.WRITE_QUEUE_WARN) {
        checks.push({ name: 'write_queue', status: 'warn', message: `${pending} writes pending`, value: pending });
    } else {
        checks.push({ name: 'write_queue', status: 'pass', message: `${pending} pending`, value: pending });
    }

    // ── 5. Write Failure Rate (last hour) ──
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();

    const { count: recentTotal } = await supabase
        .from('pms_write_queue')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .gte('created_at', oneHourAgo);

    const { count: recentFailed } = await supabase
        .from('pms_write_queue')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .eq('status', 'failed')
        .gte('created_at', oneHourAgo);

    const failureRate = (recentTotal || 0) > 0 ? (recentFailed || 0) / (recentTotal || 1) : 0;
    bridgeMetrics.writeFailureRate.set({ clinic_id: clinicId }, failureRate);

    if (failureRate > THRESHOLDS.WRITE_FAILURE_RATE_CRITICAL) {
        checks.push({ name: 'write_failures', status: 'fail', message: `${Math.round(failureRate * 100)}% write failure rate`, value: failureRate });
        alerts.push(createAlert(clinicId, 'critical', 'High Write Failure Rate', `${Math.round(failureRate * 100)}% of PMS write-backs failed in the last hour.`));
    } else if (failureRate > THRESHOLDS.WRITE_FAILURE_RATE_WARN) {
        checks.push({ name: 'write_failures', status: 'warn', message: `${Math.round(failureRate * 100)}% failure rate`, value: failureRate });
    } else {
        checks.push({ name: 'write_failures', status: 'pass', message: `${Math.round(failureRate * 100)}% failure rate`, value: failureRate });
    }

    // ── 6. Consecutive Failures ──
    const consecutiveFailures = device.consecutive_failures || 0;
    bridgeMetrics.consecutiveFailures.set({ clinic_id: clinicId }, consecutiveFailures);

    if (consecutiveFailures >= THRESHOLDS.CONSECUTIVE_FAILURE_CRITICAL) {
        checks.push({ name: 'consecutive_failures', status: 'fail', message: `${consecutiveFailures} consecutive failures — sync auto-disabled`, value: consecutiveFailures });
        alerts.push(createAlert(clinicId, 'critical', 'Bridge Auto-Disabled', `${consecutiveFailures} consecutive sync failures. Bridge sync has been automatically disabled.`, true));
    } else if (consecutiveFailures >= THRESHOLDS.CONSECUTIVE_FAILURE_WARN) {
        checks.push({ name: 'consecutive_failures', status: 'warn', message: `${consecutiveFailures} consecutive failures`, value: consecutiveFailures });
    } else {
        checks.push({ name: 'consecutive_failures', status: 'pass', message: `${consecutiveFailures} failures`, value: consecutiveFailures });
    }

    // ── 7. Device Status ──
    const statusValue = device.status === 'active' ? 1 : device.status === 'offline' ? 0 : -1;
    bridgeMetrics.deviceStatus.set({ clinic_id: clinicId, pms_provider: device.pms_provider }, statusValue);

    // ── 8. Entity Map Size ──
    const { count: entityCount } = await supabase
        .from('pms_entity_map')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId);

    bridgeMetrics.entityMapSize.set({ clinic_id: clinicId, entity_type: 'all' }, entityCount || 0);

    // ── Determine Overall Status ──
    const hasCritical = checks.some((c) => c.status === 'fail');
    const hasWarn = checks.some((c) => c.status === 'warn');
    const overallStatus = hasCritical ? 'critical' : hasWarn ? 'degraded' : 'healthy';

    const report: BridgeHealthReport = {
        clinicId,
        generatedAt: new Date().toISOString(),
        overallStatus,
        checks,
        alerts,
        metrics: {
            heartbeatAgeSec,
            syncLagSec,
            writeQueuePending: pending,
            writeQueueFailed: recentFailed || 0,
            writeFailureRate: failureRate,
            totalRecordsSynced: device.total_records_synced || 0,
            totalWritesExecuted: device.total_writes_executed || 0,
            consecutiveFailures,
            entityMapSize: entityCount || 0,
        },
    };

    // Persist alerts
    for (const alert of alerts) {
        await persistAlert(alert);
    }

    return report;
}

// ═══════════════════════════════════════════════════════════
// ALERT SYSTEM
// ═══════════════════════════════════════════════════════════

/**
 * Run health checks for ALL clinics with active bridges.
 * Called by the cron monitor every 2 minutes.
 */
export async function runBridgeHealthScan(): Promise<{
    clinicsChecked: number;
    alertsTriggered: number;
    autoRecoveries: number;
}> {
    const { data: devices } = await supabase
        .from('bridge_devices')
        .select('clinic_id, status')
        .in('status', ['active', 'offline']);

    let alertsTriggered = 0;
    let autoRecoveries = 0;

    for (const device of devices || []) {
        const report = await generateBridgeHealthReport(device.clinic_id);
        alertsTriggered += report.alerts.length;

        // Auto-recovery for specific scenarios
        for (const alert of report.alerts) {
            if (alert.autoRecover) {
                const recovered = await attemptAutoRecovery(device.clinic_id, alert);
                if (recovered) autoRecoveries++;
            }
        }
    }

    return {
        clinicsChecked: (devices || []).length,
        alertsTriggered,
        autoRecoveries,
    };
}

/**
 * Attempt automatic recovery for specific failure types.
 */
async function attemptAutoRecovery(clinicId: string, alert: BridgeAlert): Promise<boolean> {
    switch (true) {
        case alert.title.includes('Write Queue Overloaded'):
            // Cancel writes older than 1 hour
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
            const { data } = await supabase
                .from('pms_write_queue')
                .update({ status: 'cancelled' })
                .eq('clinic_id', clinicId)
                .in('status', ['pending', 'claimed'])
                .lt('created_at', oneHourAgo)
                .select('id');
            const count = data?.length || 0;

            logger.info('Auto-recovery: cancelled stale writes', { clinicId, cancelled: count });
            return true;

        case alert.title.includes('Auto-Disabled'):
            // Reset consecutive failures if device came back online
            const { data: device } = await supabase
                .from('bridge_devices')
                .select('last_heartbeat_at')
                .eq('clinic_id', clinicId)
                .single();

            if (device?.last_heartbeat_at) {
                const age = Date.now() - new Date(device.last_heartbeat_at).getTime();
                if (age < 120000) { // Heartbeat within 2 min
                    await supabase
                        .from('bridge_devices')
                        .update({ consecutive_failures: 0, status: 'active' })
                        .eq('clinic_id', clinicId);
                    logger.info('Auto-recovery: re-enabled bridge after heartbeat detected', { clinicId });
                    return true;
                }
            }
            return false;

        default:
            return false;
    }
}

// ═══════════════════════════════════════════════════════════
// ALERT PERSISTENCE & DISPATCH
// ═══════════════════════════════════════════════════════════

/**
 * Persist an alert to the database and dispatch notifications.
 */
async function persistAlert(alert: BridgeAlert): Promise<void> {
    try {
        // Check if duplicate (same title + clinic in last 30 min)
        const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
        const { count } = await supabase
            .from('pms_bridge_audit_log')
            .select('id', { count: 'exact', head: true })
            .eq('clinic_id', alert.clinicId)
            .eq('operation', `alert:${alert.title}`)
            .gte('created_at', thirtyMinAgo);

        if ((count || 0) > 0) return; // Suppress duplicate

        // Log to audit trail
        await supabase
            .from('pms_bridge_audit_log')
            .insert({
                clinic_id: alert.clinicId,
                direction: 'bidirectional',
                entity_type: 'patient',
                operation: `alert:${alert.title}`,
                status: alert.severity === 'critical' ? 'failed' : 'partial',
                error_message: alert.message,
                payload_summary: { severity: alert.severity, autoRecover: alert.autoRecover },
            });

        // Dispatch alert via webhook (if configured)
        await dispatchAlertWebhook(alert);

        logger.warn('Bridge health alert triggered', {
            clinicId: alert.clinicId,
            severity: alert.severity,
            title: alert.title,
        });
    } catch (error) {
        logger.error('Failed to persist alert', { error: (error as Error).message });
    }
}

/**
 * Dispatch alert to external webhook (Slack, PagerDuty, email service).
 */
async function dispatchAlertWebhook(alert: BridgeAlert): Promise<void> {
    const webhookUrl = process.env.BRIDGE_ALERT_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: `🔔 *OraDesk Bridge Alert* [${alert.severity.toUpperCase()}]\n*${alert.title}*\n${alert.message}\nClinic: ${alert.clinicId}`,
                severity: alert.severity,
                clinic_id: alert.clinicId,
                timestamp: alert.triggeredAt,
            }),
        });
    } catch {
        // Non-critical — don't fail on webhook dispatch
    }
}

// ─── Helpers ────────────────────────────────────────────────

function createAlert(
    clinicId: string,
    severity: 'info' | 'warning' | 'critical',
    title: string,
    message: string,
    autoRecover: boolean = false,
): BridgeAlert {
    return {
        id: `bridge-alert-${clinicId}-${Date.now()}`,
        severity,
        title,
        message,
        clinicId,
        triggeredAt: new Date().toISOString(),
        autoRecover,
    };
}

function emptyMetrics(): BridgeMetricSnapshot {
    return {
        heartbeatAgeSec: Infinity,
        syncLagSec: Infinity,
        writeQueuePending: 0,
        writeQueueFailed: 0,
        writeFailureRate: 0,
        totalRecordsSynced: 0,
        totalWritesExecuted: 0,
        consecutiveFailures: 0,
        entityMapSize: 0,
    };
}
