/**
 * ORADESK AI — GOOGLE CALENDAR ROUTES
 * ═══════════════════════════════════════════════════════════
 *
 * Routes:
 *   GET  /v1/calendar/oauth/connect     → Generate OAuth consent URL
 *   GET  /v1/calendar/oauth/callback    → Handle OAuth callback
 *   POST /v1/calendar/webhook           → Handle Google push notifications
 *   GET  /v1/calendar/status            → Get connection status for clinic
 *   POST /v1/calendar/sync              → Manual sync trigger
 *   GET  /v1/calendar/availability      → Dynamic availability API
 *   POST /v1/calendar/disconnect        → Disconnect calendar
 *   POST /v1/calendar/check-conflicts   → Pre-creation conflict check
 */

import { Router, Request, Response } from 'express';
import { calendarOAuth, calendarSync } from '../services/calendar-service';
import { logger } from '../lib/logging/structured-logger';

const router = Router();

// ═══════════════════════════════════════════════════════════
// 1. OAUTH FLOW
// ═══════════════════════════════════════════════════════════

/**
 * GET /connect
 * Generates Google OAuth consent URL for a clinic.
 * Requires authenticated clinic admin.
 */
router.get('/oauth/connect', async (req: Request, res: Response) => {
    try {
        const clinicId = req.clinicId;
        if (!clinicId) {
            return res.status(400).json({ error: 'Missing clinic context' });
        }

        const authUrl = calendarOAuth.getAuthUrl(clinicId);
        res.json({ url: authUrl });
    } catch (error) {
        logger.error('Failed to generate OAuth URL', { error: (error as Error).message });
        res.status(500).json({ error: 'Failed to generate auth URL' });
    }
});

/**
 * GET /callback
 * Handles the OAuth callback from Google.
 * Receives authorization code, exchanges for tokens, stores encrypted.
 */
router.get('/oauth/callback', async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const clinicId = req.query.state as string;

    if (!code || !clinicId) {
        return res.status(400).json({ error: 'Missing authorization code or clinic ID' });
    }

    try {
        const userId = req.user?.sub || 'system';
        const result = await calendarOAuth.handleCallback(code, clinicId, userId);

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        // Register webhook channel for push notifications
        await calendarSync.registerWebhookChannel(clinicId);

        // Redirect back to frontend
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8085';
        res.redirect(`${frontendUrl}/calendar?connected=true`);
    } catch (error) {
        logger.error('OAuth callback error', { error: (error as Error).message, clinicId });
        res.status(500).json({ error: 'OAuth callback failed' });
    }
});

// ═══════════════════════════════════════════════════════════
// 2. GOOGLE CALENDAR WEBHOOK
// ═══════════════════════════════════════════════════════════

/**
 * POST /webhook
 * Receives push notifications from Google Calendar.
 * Google sends a POST with channel/resource IDs in headers.
 *
 * PUBLIC endpoint — no auth required.
 * Verified via channel ID matching in DB.
 */
router.post('/webhook', async (req: Request, res: Response) => {
    // Google sends these in custom headers
    const channelId = req.headers['x-goog-channel-id'] as string;
    const resourceId = req.headers['x-goog-resource-id'] as string;
    const resourceState = req.headers['x-goog-resource-state'] as string;

    if (!channelId || !resourceId) {
        return res.status(400).send('Missing channel headers');
    }

    // Always respond 200 immediately (Google requires fast response)
    res.sendStatus(200);

    // Ignore sync verification requests
    if (resourceState === 'sync') {
        logger.debug('Google Calendar sync verification received', { channelId });
        return;
    }

    // Process in background (don't hold up the response)
    setImmediate(async () => {
        try {
            await calendarSync.handleWebhookNotification(channelId, resourceId);
        } catch (error) {
            logger.error('Failed to process Google Calendar webhook', {
                error: (error as Error).message,
                channelId,
                resourceId,
            });
        }
    });
});

// ═══════════════════════════════════════════════════════════
// 3. CONNECTION STATUS
// ═══════════════════════════════════════════════════════════

/**
 * GET /status
 * Returns the Google Calendar connection status for the current clinic.
 */
router.get('/status', async (req: Request, res: Response) => {
    const clinicId = req.clinicId;
    if (!clinicId) {
        return res.status(400).json({ error: 'Missing clinic context' });
    }

    try {
        const { data, error } = await req.supabaseUser!
            .from('clinic_calendar_connections')
            .select(`
        id, provider, provider_account_email, status,
        sync_direction, sync_enabled, auto_confirm_external,
        last_synced_at, last_sync_error, consecutive_failures,
        connected_at, webhook_expiry
      `)
            .eq('clinic_id', clinicId)
            .eq('provider', 'google_calendar')
            .single();

        if (error || !data) {
            return res.json({ connected: false });
        }

        res.json({
            connected: data.status === 'active',
            ...data,
            webhook_active: data.webhook_expiry
                ? new Date(data.webhook_expiry) > new Date()
                : false,
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get status' });
    }
});

// ═══════════════════════════════════════════════════════════
// 4. MANUAL SYNC
// ═══════════════════════════════════════════════════════════

/**
 * POST /sync
 * Triggers a manual full sync for the clinic.
 * Useful for initial setup or recovering from errors.
 */
router.post('/sync', async (req: Request, res: Response) => {
    const clinicId = req.clinicId;
    if (!clinicId) {
        return res.status(400).json({ error: 'Missing clinic context' });
    }

    try {
        // Get all appointments with pending_push status
        const { data: pendingAppts } = await req.supabaseUser!
            .from('appointments')
            .select('*')
            .eq('clinic_id', clinicId)
            .in('sync_status', ['pending_push', 'failed'])
            .neq('status', 'cancelled');

        let pushed = 0;
        let failed = 0;

        for (const apt of pendingAppts || []) {
            const result = await calendarSync.pushAppointment(apt);
            if (result.success) pushed++;
            else failed++;
        }

        res.json({
            message: 'Manual sync completed',
            pushed,
            failed,
            total: (pendingAppts || []).length,
        });
    } catch (error) {
        res.status(500).json({ error: 'Sync failed' });
    }
});

// ═══════════════════════════════════════════════════════════
// 5. DYNAMIC AVAILABILITY
// ═══════════════════════════════════════════════════════════

/**
 * GET /availability?date=YYYY-MM-DD&duration=30
 * Returns available time slots for a given date.
 */
router.get('/availability', async (req: Request, res: Response) => {
    const clinicId = req.clinicId;
    const date = req.query.date as string;
    const duration = parseInt(req.query.duration as string) || 30;

    if (!clinicId || !date) {
        return res.status(400).json({ error: 'Missing clinic context or date' });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    try {
        const slots = await calendarSync.getAvailableSlots(clinicId, date, duration);
        res.json({ date, duration, slots, count: slots.length });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch availability' });
    }
});

// ═══════════════════════════════════════════════════════════
// 6. CONFLICT CHECK
// ═══════════════════════════════════════════════════════════

/**
 * POST /check-conflicts
 * Pre-creation conflict detection.
 * Body: { start_time, end_time, exclude_appointment_id? }
 */
router.post('/check-conflicts', async (req: Request, res: Response) => {
    const clinicId = req.clinicId;
    const { start_time, end_time, exclude_appointment_id } = req.body;

    if (!clinicId || !start_time || !end_time) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const conflicts = await calendarSync.checkConflicts(
            clinicId,
            start_time,
            end_time,
            exclude_appointment_id,
        );

        res.json({
            has_conflicts: conflicts.length > 0,
            conflicts,
        });
    } catch (error) {
        res.status(500).json({ error: 'Conflict check failed' });
    }
});

// ═══════════════════════════════════════════════════════════
// 7. DISCONNECT
// ═══════════════════════════════════════════════════════════

/**
 * POST /disconnect
 * Disconnects the Google Calendar integration for the clinic.
 * Stops webhook channel and marks connection as disconnected.
 */
router.post('/disconnect', async (req: Request, res: Response) => {
    const clinicId = req.clinicId;
    if (!clinicId) {
        return res.status(400).json({ error: 'Missing clinic context' });
    }

    try {
        // Stop webhook channel
        await calendarSync.stopWebhookChannel(clinicId);

        // Mark as disconnected
        await req.supabaseUser!
            .from('clinic_calendar_connections')
            .update({
                status: 'disconnected',
                sync_enabled: false,
                disconnected_at: new Date().toISOString(),
            })
            .eq('clinic_id', clinicId)
            .eq('provider', 'google_calendar');

        logger.info('Google Calendar disconnected', { clinicId });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to disconnect' });
    }
});

// ═══════════════════════════════════════════════════════════
// 8. SYNC LOG
// ═══════════════════════════════════════════════════════════

/**
 * GET /sync-log?limit=20
 * Returns recent sync log entries for audit purposes.
 */
router.get('/sync-log', async (req: Request, res: Response) => {
    const clinicId = req.clinicId;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!clinicId) {
        return res.status(400).json({ error: 'Missing clinic context' });
    }

    try {
        const { data, error } = await req.supabaseUser!
            .from('calendar_sync_log')
            .select('*')
            .eq('clinic_id', clinicId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        res.json({ logs: data || [] });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sync log' });
    }
});

export default router;
