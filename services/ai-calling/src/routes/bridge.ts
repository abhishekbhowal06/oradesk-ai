/**
 * ORADESK AI — PMS BRIDGE API ROUTES
 * ═══════════════════════════════════════════════════════════
 *
 * Cloud-side routes for bridge device management and sync.
 *
 * Admin Routes (JWT authenticated):
 *   POST /v1/bridge/activate           → Generate activation code
 *   GET  /v1/bridge/status             → Get device status
 *   POST /v1/bridge/disconnect         → Disconnect device
 *   POST /v1/bridge/write              → Queue a write command
 *   GET  /v1/bridge/audit-log          → Get audit log
 *   GET  /v1/bridge/entity-map         → Get entity mappings
 *
 * Agent Routes (Device-token authenticated):
 *   POST /v1/bridge/agent/register     → Device activation with code
 *   POST /v1/bridge/agent/heartbeat    → Agent heartbeat
 *   GET  /v1/bridge/agent/writes       → Poll pending writes
 *   POST /v1/bridge/agent/write-result → Report write result
 *   POST /v1/bridge/agent/sync-report  → Report sync batch results
 */

import { Router, Request, Response } from 'express';
import {
    generateActivationCode,
    activateDevice,
    processHeartbeat,
    getBridgeStatus,
    queuePmsWrite,
    getPendingWrites,
    reportWriteResult,
    getAuditLog,
} from '../services/OraBridge';
import { logger } from '../lib/logging/structured-logger';
import { supabaseAdmin } from '../lib/supabase';

const router = Router();

// ═══════════════════════════════════════════════════════════
// ADMIN ROUTES (JWT Authenticated)
// ═══════════════════════════════════════════════════════════

/**
 * POST /activate
 * Generate a 6-digit activation code for bridge setup.
 *
 * Called by clinic admin from the settings page.
 */
router.post('/activate', async (req: Request, res: Response) => {
    const clinicId = req.clinicId;
    if (!clinicId) return res.status(400).json({ error: 'Missing clinic context' });

    try {
        const result = await generateActivationCode(clinicId);
        res.json({
            message: 'Activation code generated',
            code: result.code,
            expires_at: result.expiresAt,
            instructions: [
                '1. Download OraDesk Bridge from Settings → Integrations',
                '2. Run the installer on the clinic server',
                '3. Run: oradesk-bridge --setup',
                '4. Enter this activation code when prompted',
                `5. Code expires at ${new Date(result.expiresAt).toLocaleTimeString()}`,
            ],
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate activation code' });
    }
});

/**
 * GET /status
 * Get the current bridge device status for the clinic.
 */
router.get('/status', async (req: Request, res: Response) => {
    const clinicId = req.clinicId;
    if (!clinicId) return res.status(400).json({ error: 'Missing clinic context' });

    try {
        const status = await getBridgeStatus(clinicId);
        if (!status) {
            return res.json({ connected: false, message: 'No bridge device registered' });
        }

        // Get pending write count
        const { count } = await req.supabaseUser!
            .from('pms_write_queue')
            .select('id', { count: 'exact', head: true })
            .eq('clinic_id', clinicId)
            .in('status', ['pending', 'claimed']);

        res.json({
            connected: status.status === 'active',
            ...status,
            pendingWrites: count || 0,
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get status' });
    }
});

/**
 * POST /disconnect
 * Disconnect and suspend the bridge device.
 */
router.post('/disconnect', async (req: Request, res: Response) => {
    const clinicId = req.clinicId;
    if (!clinicId) return res.status(400).json({ error: 'Missing clinic context' });

    try {
        await req.supabaseUser!
            .from('bridge_devices')
            .update({
                status: 'suspended',
                suspended_at: new Date().toISOString(),
                suspension_reason: 'Disconnected by admin',
            })
            .eq('clinic_id', clinicId);

        // Cancel all pending writes
        await req.supabaseUser!
            .from('pms_write_queue')
            .update({ status: 'cancelled' })
            .eq('clinic_id', clinicId)
            .in('status', ['pending', 'claimed']);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to disconnect bridge' });
    }
});

/**
 * POST /write
 * Queue a write command for the bridge agent.
 *
 * Body: { operation, oradesk_id?, pms_id?, payload }
 */
router.post('/write', async (req: Request, res: Response) => {
    const clinicId = req.clinicId;
    const userId = req.user?.sub;
    const { operation, oradesk_id, pms_id, payload } = req.body;

    if (!clinicId || !operation || !payload) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const result = await queuePmsWrite({
            clinicId,
            operation,
            oradeskId: oradesk_id,
            pmsId: pms_id,
            payload,
            requestedBy: userId ? `staff:${userId}` : 'system',
        });

        if (!result.success) {
            return res.status(503).json({ error: result.error });
        }

        res.json({
            message: 'Write command queued',
            write_id: result.writeId,
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to queue write' });
    }
});

/**
 * GET /audit-log
 * Get recent bridge audit log entries.
 *
 * Query: ?limit=50
 */
router.get('/audit-log', async (req: Request, res: Response) => {
    const clinicId = req.clinicId;
    const limit = parseInt(req.query.limit as string) || 50;

    if (!clinicId) return res.status(400).json({ error: 'Missing clinic context' });

    try {
        const logs = await getAuditLog(clinicId, limit);
        res.json({ logs });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
});

/**
 * GET /entity-map
 * Get entity mappings between PMS and OraDesk.
 *
 * Query: ?entity_type=patient&limit=100
 */
router.get('/entity-map', async (req: Request, res: Response) => {
    const clinicId = req.clinicId;
    const entityType = req.query.entity_type as string;
    const limit = parseInt(req.query.limit as string) || 100;

    if (!clinicId) return res.status(400).json({ error: 'Missing clinic context' });

    try {
        let query = req.supabaseUser!
            .from('pms_entity_map')
            .select('*')
            .eq('clinic_id', clinicId)
            .order('last_synced_at', { ascending: false })
            .limit(limit);

        if (entityType) {
            query = query.eq('entity_type', entityType);
        }

        const { data, error } = await query;
        if (error) throw error;

        res.json({ mappings: data || [] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch entity map' });
    }
});

/**
 * GET /write-history
 * Get recent write queue entries (completed and failed).
 *
 * Query: ?limit=20
 */
router.get('/write-history', async (req: Request, res: Response) => {
    const clinicId = req.clinicId;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!clinicId) return res.status(400).json({ error: 'Missing clinic context' });

    try {
        const { data, error } = await req.supabaseUser!
            .from('pms_write_queue')
            .select('*')
            .eq('clinic_id', clinicId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        res.json({ writes: data || [] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch write history' });
    }
});

// ═══════════════════════════════════════════════════════════
// AGENT ROUTES (Device-token authenticated)
// ═══════════════════════════════════════════════════════════

/**
 * POST /agent/register
 * Register/activate a bridge device using activation code.
 *
 * Body: { clinic_id, activation_code, device_token, pms_provider, agent_version }
 */
router.post('/agent/register', async (req: Request, res: Response) => {
    const { clinic_id, activation_code, device_token, pms_provider, agent_version } = req.body;

    if (!clinic_id || !activation_code || !device_token) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const result = await activateDevice(
            clinic_id,
            activation_code,
            device_token,
            pms_provider || 'opendental',
            agent_version || '1.0.0',
        );

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        res.json({
            success: true,
            device_id: result.deviceId,
            message: 'Bridge device activated successfully',
        });
    } catch (error) {
        res.status(500).json({ error: 'Activation failed' });
    }
});

/**
 * POST /agent/heartbeat
 * Agent heartbeat — keeps status active and reports stats.
 *
 * Body: { clinic_id, device_token, stats?: { totalSynced, totalWrites } }
 */
router.post('/agent/heartbeat', async (req: Request, res: Response) => {
    const { clinic_id, device_token, stats } = req.body;

    if (!clinic_id || !device_token) {
        return res.status(400).json({ error: 'Missing credentials' });
    }

    try {
        const result = await processHeartbeat(clinic_id, device_token, stats);
        if (!result.success) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        res.json({
            acknowledged: true,
            pending_writes: result.pendingWrites,
        });
    } catch (error) {
        res.status(500).json({ error: 'Heartbeat failed' });
    }
});

/**
 * GET /agent/writes
 * Poll for pending write commands.
 *
 * Headers: x-device-token, x-clinic-id
 * Query: ?limit=5
 */
router.get('/agent/writes', async (req: Request, res: Response) => {
    const clinicId = req.headers['x-clinic-id'] as string;
    const deviceToken = req.headers['x-device-token'] as string;
    const limit = parseInt(req.query.limit as string) || 5;

    if (!clinicId || !deviceToken) {
        return res.status(400).json({ error: 'Missing credentials in headers' });
    }

    try {
        const writes = await getPendingWrites(clinicId, deviceToken, limit);
        res.json({ writes });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch writes' });
    }
});

/**
 * POST /agent/write-result
 * Report the result of a write execution.
 *
 * Body: { write_id, success, pms_id?, error?, conflict_detected? }
 */
router.post('/agent/write-result', async (req: Request, res: Response) => {
    const { write_id, success, pms_id, error: writeError, conflict_detected } = req.body;

    if (!write_id) {
        return res.status(400).json({ error: 'Missing write_id' });
    }

    try {
        await reportWriteResult(write_id, {
            success,
            pmsId: pms_id,
            error: writeError,
            conflictDetected: conflict_detected,
        });

        res.json({ acknowledged: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to report result' });
    }
});

/**
 * POST /agent/sync-report
 * Agent reports a completed sync batch.
 *
 * Body: { clinic_id, device_token, direction, entity_type, record_count, status, duration_ms }
 */
router.post('/agent/sync-report', async (req: Request, res: Response) => {
    const { clinic_id, device_token, ...report } = req.body;

    if (!clinic_id || !device_token) {
        return res.status(400).json({ error: 'Missing credentials' });
    }

    try {
        // Verify token
        const tokenHash = require('crypto').createHash('sha256').update(device_token).digest('hex');
        // JUSTIFICATION: Agent routes use device-token auth, not JWT — service_role required
        const { data: device } = await supabaseAdmin
            .from('bridge_devices')
            .select('id')
            .eq('clinic_id', clinic_id)
            .eq('device_token_hash', tokenHash)
            .single();

        if (!device) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Write to audit log
        await supabaseAdmin
            .from('pms_bridge_audit_log')
            .insert({
                clinic_id,
                device_id: device.id,
                ...report,
                completed_at: new Date().toISOString(),
            });

        // Update last_sync_at on device
        await supabaseAdmin
            .from('bridge_devices')
            .update({ last_sync_at: new Date().toISOString() })
            .eq('id', device.id);

        res.json({ acknowledged: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save sync report' });
    }
});

export default router;
