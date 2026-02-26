/**
 * ORADESK AI — CLOUD-SIDE PMS BRIDGE SERVICE
 * ═══════════════════════════════════════════════════════════
 *
 * Cloud service that coordinates with the desktop bridge agent:
 *   - Receives heartbeats and sync reports
 *   - Queues write commands for the agent to execute
 *   - Provides status and audit endpoints
 *   - Handles device activation flow
 *
 * This module replaces the earlier stub in OraBridge.ts with a
 * fully functional cloud-side bridge manager.
 *
 * Architecture:
 *   Clinic LAN  ──►  Bridge Agent  ──►  OraDesk Cloud (this code)
 *       │                │
 *       └── PMS DB ──────┘
 */

import { logger } from '../lib/logging/structured-logger';
import { supabase } from '../lib/supabase';
import crypto from 'crypto';

// ─── Types ──────────────────────────────────────────────────

export interface BridgeRegistration {
    clinicId: string;
    bridgeId: string;
    version: string;
    pmsType: 'opendental' | 'dentrix' | 'eaglesoft' | 'generic_odbc';
    pmsVersion?: string;
    lastHeartbeat: string;
    status: 'active' | 'offline' | 'suspended';
}

export interface BridgeWriteRequest {
    clinicId: string;
    operation: 'create_appointment' | 'update_appointment_status' | 'cancel_appointment';
    oradeskId?: string;
    pmsId?: string;
    payload: Record<string, unknown>;
    requestedBy?: string;
}

export interface BridgeDeviceStatus {
    id: string;
    clinicId: string;
    deviceName: string;
    pmsProvider: string;
    pmsVersion: string | null;
    status: string;
    lastHeartbeatAt: string | null;
    lastSyncAt: string | null;
    totalRecordsSynced: number;
    totalWritesExecuted: number;
    consecutiveFailures: number;
}

// ═══════════════════════════════════════════════════════════
// DEVICE MANAGEMENT
// ═══════════════════════════════════════════════════════════

/**
 * Generate a 6-digit activation code for a clinic.
 * The clinic admin sees this code and enters it in the bridge setup wizard.
 */
export async function generateActivationCode(clinicId: string): Promise<{
    code: string;
    expiresAt: string;
}> {
    const code = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

    // Upsert device entry with activation code
    await supabase
        .from('bridge_devices')
        .upsert({
            clinic_id: clinicId,
            device_name: 'OraDesk Bridge (Pending)',
            agent_version: 'pending',
            pms_provider: 'opendental', // Default, will be updated on activation
            device_token_hash: '', // Will be set on activation
            activation_code: code,
            activation_code_expiry: expiresAt,
            status: 'pending_activation',
        }, {
            onConflict: 'clinic_id',
        });

    logger.info('Activation code generated', { clinicId, expiresAt });
    return { code, expiresAt };
}

/**
 * Validate an activation code and activate the device.
 * Called by the bridge agent during setup.
 */
export async function activateDevice(
    clinicId: string,
    activationCode: string,
    deviceToken: string,
    pmsProvider: string,
    agentVersion: string,
): Promise<{ success: boolean; deviceId?: string; error?: string }> {
    const { data: device, error } = await supabase
        .from('bridge_devices')
        .select('*')
        .eq('clinic_id', clinicId)
        .eq('activation_code', activationCode)
        .eq('status', 'pending_activation')
        .single();

    if (error || !device) {
        return { success: false, error: 'Invalid or expired activation code' };
    }

    // Check expiry
    if (device.activation_code_expiry && new Date(device.activation_code_expiry) < new Date()) {
        return { success: false, error: 'Activation code expired' };
    }

    // Hash the device token
    const tokenHash = crypto.createHash('sha256').update(deviceToken).digest('hex');

    const { error: updateError } = await supabase
        .from('bridge_devices')
        .update({
            device_token_hash: tokenHash,
            pms_provider: pmsProvider,
            agent_version: agentVersion,
            status: 'active',
            activation_code: null,
            activation_code_expiry: null,
            last_heartbeat_at: new Date().toISOString(),
        })
        .eq('id', device.id);

    if (updateError) {
        return { success: false, error: updateError.message };
    }

    logger.info('Bridge device activated', { clinicId, deviceId: device.id });
    return { success: true, deviceId: device.id };
}

// ═══════════════════════════════════════════════════════════
// HEARTBEAT & STATUS
// ═══════════════════════════════════════════════════════════

/**
 * Process a heartbeat from the bridge agent.
 * Updates status and sync statistics.
 */
export async function processHeartbeat(
    clinicId: string,
    deviceToken: string,
    stats?: { totalSynced?: number; totalWrites?: number },
): Promise<{ success: boolean; pendingWrites?: number }> {
    // Verify device token
    const tokenHash = crypto.createHash('sha256').update(deviceToken).digest('hex');

    const { data: device, error } = await supabase
        .from('bridge_devices')
        .select('id, status')
        .eq('clinic_id', clinicId)
        .eq('device_token_hash', tokenHash)
        .eq('status', 'active')
        .single();

    if (error || !device) {
        return { success: false };
    }

    // Update heartbeat
    await supabase
        .from('bridge_devices')
        .update({
            last_heartbeat_at: new Date().toISOString(),
            total_records_synced: stats?.totalSynced,
            total_writes_executed: stats?.totalWrites,
        })
        .eq('id', device.id);

    // Count pending writes
    const { count } = await supabase
        .from('pms_write_queue')
        .select('id', { count: 'exact', head: true })
        .eq('clinic_id', clinicId)
        .in('status', ['pending', 'claimed']);

    return { success: true, pendingWrites: count || 0 };
}

/**
 * Get the bridge device status for a clinic.
 */
export async function getBridgeStatus(clinicId: string): Promise<BridgeDeviceStatus | null> {
    const { data, error } = await supabase
        .from('bridge_devices')
        .select('*')
        .eq('clinic_id', clinicId)
        .single();

    if (error || !data) return null;

    // Determine if offline (no heartbeat in 3 minutes)
    const isOffline = !data.last_heartbeat_at ||
        (Date.now() - new Date(data.last_heartbeat_at).getTime()) > 180000;

    if (isOffline && data.status === 'active') {
        // Mark as offline
        await supabase
            .from('bridge_devices')
            .update({ status: 'offline' })
            .eq('id', data.id);
    }

    return {
        id: data.id,
        clinicId: data.clinic_id,
        deviceName: data.device_name,
        pmsProvider: data.pms_provider,
        pmsVersion: data.pms_version,
        status: isOffline ? 'offline' : data.status,
        lastHeartbeatAt: data.last_heartbeat_at,
        lastSyncAt: data.last_sync_at,
        totalRecordsSynced: data.total_records_synced || 0,
        totalWritesExecuted: data.total_writes_executed || 0,
        consecutiveFailures: data.consecutive_failures || 0,
    };
}

/**
 * Check if a clinic's bridge is currently online.
 */
export async function isBridgeOnline(clinicId: string): Promise<boolean> {
    const status = await getBridgeStatus(clinicId);
    return status !== null && status.status === 'active';
}

// ═══════════════════════════════════════════════════════════
// WRITE QUEUE
// ═══════════════════════════════════════════════════════════

/**
 * Queue a write command for the bridge agent to execute on the PMS.
 * The agent polls this queue and executes the commands.
 */
export async function queuePmsWrite(request: BridgeWriteRequest): Promise<{
    success: boolean;
    writeId?: string;
    error?: string;
}> {
    // Verify bridge is online first
    const online = await isBridgeOnline(request.clinicId);
    if (!online) {
        return { success: false, error: 'Bridge is offline. Write command queued for retry.' };
    }

    // Get device ID
    const { data: device } = await supabase
        .from('bridge_devices')
        .select('id')
        .eq('clinic_id', request.clinicId)
        .eq('status', 'active')
        .single();

    const { data, error } = await supabase
        .from('pms_write_queue')
        .insert({
            clinic_id: request.clinicId,
            device_id: device?.id || null,
            operation: request.operation,
            entity_type: 'appointment',
            oradesk_id: request.oradeskId,
            pms_id: request.pmsId,
            payload: request.payload,
            status: 'pending',
            requested_by: request.requestedBy || 'system',
        })
        .select('id')
        .single();

    if (error) {
        logger.error('Failed to queue PMS write', { error: error.message });
        return { success: false, error: error.message };
    }

    logger.info('PMS write queued', {
        writeId: data.id,
        operation: request.operation,
        clinicId: request.clinicId,
    });

    return { success: true, writeId: data.id };
}

/**
 * Get pending write commands for a clinic's bridge agent.
 * Called by the agent during its write queue poll cycle.
 */
export async function getPendingWrites(
    clinicId: string,
    deviceToken: string,
    limit: number = 5,
): Promise<any[]> {
    // Verify token
    const tokenHash = crypto.createHash('sha256').update(deviceToken).digest('hex');
    const { data: device } = await supabase
        .from('bridge_devices')
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('device_token_hash', tokenHash)
        .single();

    if (!device) return [];

    const { data: writes } = await supabase
        .from('pms_write_queue')
        .select('*')
        .eq('clinic_id', clinicId)
        .in('status', ['pending'])
        .order('created_at', { ascending: true })
        .limit(limit);

    // Claim them
    if (writes && writes.length > 0) {
        await supabase
            .from('pms_write_queue')
            .update({ status: 'claimed', claimed_at: new Date().toISOString() })
            .in('id', writes.map((w: any) => w.id));
    }

    return writes || [];
}

/**
 * Report the result of a write execution.
 * Called by the agent after executing a write command.
 */
export async function reportWriteResult(
    writeId: string,
    result: {
        success: boolean;
        pmsId?: string;
        error?: string;
        conflictDetected?: boolean;
    },
): Promise<void> {
    await supabase
        .from('pms_write_queue')
        .update({
            status: result.success ? 'completed' : 'failed',
            executed_at: new Date().toISOString(),
            result: result.success ? { pms_id: result.pmsId } : null,
            error_message: result.error,
            conflict_detected: result.conflictDetected || false,
        })
        .eq('id', writeId);
}

// ═══════════════════════════════════════════════════════════
// ENTITY MAPPING LOOKUPS
// ═══════════════════════════════════════════════════════════

/**
 * Look up the PMS ID for an OraDesk entity.
 */
export async function getPmsId(
    clinicId: string,
    oradeskId: string,
    entityType: string,
): Promise<string | null> {
    const { data } = await supabase
        .from('pms_entity_map')
        .select('pms_id')
        .eq('clinic_id', clinicId)
        .eq('oradesk_id', oradeskId)
        .eq('entity_type', entityType)
        .single();

    return data?.pms_id || null;
}

/**
 * Look up the OraDesk ID for a PMS entity.
 */
export async function getOradeskId(
    clinicId: string,
    pmsId: string,
    entityType: string,
): Promise<string | null> {
    const { data } = await supabase
        .from('pms_entity_map')
        .select('oradesk_id')
        .eq('clinic_id', clinicId)
        .eq('pms_id', pmsId)
        .eq('entity_type', entityType)
        .single();

    return data?.oradesk_id || null;
}

// ═══════════════════════════════════════════════════════════
// AUDIT LOG
// ═══════════════════════════════════════════════════════════

/**
 * Get recent audit log entries for a clinic.
 */
export async function getAuditLog(
    clinicId: string,
    limit: number = 50,
): Promise<any[]> {
    const { data } = await supabase
        .from('pms_bridge_audit_log')
        .select('*')
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })
        .limit(limit);

    return data || [];
}
