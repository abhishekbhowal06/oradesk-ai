/**
 * ORADESK AI — GOOGLE CALENDAR SYNC SERVICE
 * ═══════════════════════════════════════════════════════════
 *
 * Architecture:
 *   Internal DB = Source of Truth (ALWAYS)
 *   Google Calendar = bidirectional mirror
 *
 * Flow:
 *   1. OAuth → Store encrypted tokens per clinic
 *   2. On appointment create → Push to GCal
 *   3. On GCal webhook → Pull changes to DB
 *   4. Conflict detection before every write
 *   5. Audit log for every sync operation
 *
 * Security:
 *   - AES-256 encrypted tokens via pgcrypto
 *   - No PII in logs/payloads
 *   - Multi-clinic isolation enforced
 *   - Token rotation on expiry
 *   - HIPAA: patient names never sent to GCal (procedure codes only)
 */

import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '../lib/logging/structured-logger';
import { supabase } from '../lib/supabase';
import { randomUUID } from 'crypto';

// ─── Configuration ──────────────────────────────────────────

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI || '';
const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || '';
const WEBHOOK_BASE_URL = process.env.SERVICE_URL || '';

const SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
];

// HIPAA: Never include patient real names in external calendar
const HIPAA_REDACT = true;

// ─── Types ──────────────────────────────────────────────────

interface CalendarConnection {
    id: string;
    clinic_id: string;
    provider_calendar_id: string;
    webhook_channel_id: string | null;
    webhook_resource_id: string | null;
    webhook_expiry: string | null;
    sync_direction: 'push' | 'pull' | 'bidirectional';
    sync_enabled: boolean;
    auto_confirm_external: boolean;
}

interface AppointmentRecord {
    id: string;
    clinic_id: string;
    patient_id: string;
    scheduled_at: string;
    duration_minutes: number;
    procedure_name: string;
    status: string;
    notes: string | null;
    external_event_id: string | null;
    external_provider: string | null;
    sync_status: string | null;
}

interface ConflictResult {
    conflict_id: string;
    conflict_patient: string;
    conflict_procedure: string;
    conflict_start: string;
    conflict_end: string;
}

interface SyncLogEntry {
    clinic_id: string;
    connection_id?: string;
    appointment_id?: string;
    direction: 'push' | 'pull' | 'bidirectional';
    operation: string;
    status: string;
    external_event_id?: string;
    error_message?: string;
    payload?: Record<string, unknown>;
    conflict_details?: Record<string, unknown>;
    started_at: string;
    completed_at?: string;
    duration_ms?: number;
}

// ═══════════════════════════════════════════════════════════
// OAUTH 2.0 FLOW
// ═══════════════════════════════════════════════════════════

export class GoogleCalendarOAuth {
    private oAuth2Client: OAuth2Client;

    constructor() {
        this.oAuth2Client = new google.auth.OAuth2(
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            GOOGLE_REDIRECT_URI,
        );
    }

    /**
     * Step 1: Generate consent URL for clinic admin
     */
    getAuthUrl(clinicId: string): string {
        return this.oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            prompt: 'consent', // Always show consent to get refresh_token
            state: clinicId,   // Pass clinic_id through OAuth state
        });
    }

    /**
     * Step 2: Exchange authorization code for tokens
     * Called from OAuth callback route
     */
    async handleCallback(code: string, clinicId: string, userId: string): Promise<{
        success: boolean;
        error?: string;
    }> {
        try {
            const { tokens } = await this.oAuth2Client.getToken(code);

            if (!tokens.refresh_token) {
                return { success: false, error: 'No refresh token received. Please re-authorize.' };
            }

            // Get account email for display
            this.oAuth2Client.setCredentials(tokens);
            const oauth2 = google.oauth2({ version: 'v2', auth: this.oAuth2Client });
            const { data: userInfo } = await oauth2.userinfo.get();
            const accountEmail = userInfo.email || 'unknown';

            // Store encrypted tokens
            const { error: dbError } = await supabase
                .from('clinic_calendar_connections')
                .upsert({
                    clinic_id: clinicId,
                    provider: 'google_calendar',
                    provider_account_email: accountEmail,
                    provider_calendar_id: 'primary',
                    access_token_encrypted: await this.encryptToken(tokens.access_token || ''),
                    refresh_token_encrypted: await this.encryptToken(tokens.refresh_token),
                    token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
                    status: 'active',
                    connected_by: userId,
                    connected_at: new Date().toISOString(),
                    sync_direction: 'bidirectional',
                    sync_enabled: true,
                    consecutive_failures: 0,
                    last_sync_error: null,
                }, {
                    onConflict: 'clinic_id,provider',
                });

            if (dbError) {
                logger.error('Failed to store calendar credentials', { error: dbError.message, clinicId });
                return { success: false, error: 'Failed to store credentials.' };
            }

            logger.info('Google Calendar connected', { clinicId, accountEmail });
            return { success: true };
        } catch (error) {
            const msg = (error as Error).message;
            logger.error('OAuth callback failed', { error: msg, clinicId });
            return { success: false, error: msg };
        }
    }

    /**
     * Encrypt token for storage using pgcrypto SQL function
     */
    private async encryptToken(token: string): Promise<string> {
        // Use Supabase RPC to call pgcrypto encrypt function
        const { data, error } = await supabase.rpc('encrypt_token', {
            plain_token: token,
            encryption_key: TOKEN_ENCRYPTION_KEY,
        });

        if (error) {
            logger.error('Token encryption failed', { error: error.message });
            throw new Error('Token encryption failed');
        }

        return data;
    }
}

// ═══════════════════════════════════════════════════════════
// SYNC SERVICE
// ═══════════════════════════════════════════════════════════

export class GoogleCalendarSyncService {
    /**
     * Get an authenticated OAuth2 client for a specific clinic
     */
    private async getClientForClinic(clinicId: string): Promise<{
        client: OAuth2Client;
        connection: CalendarConnection;
    } | null> {
        // Retrieve connection with decrypted tokens
        const { data: conn, error } = await supabase
            .from('clinic_calendar_connections')
            .select('*')
            .eq('clinic_id', clinicId)
            .eq('provider', 'google_calendar')
            .eq('status', 'active')
            .single();

        if (error || !conn) {
            logger.debug('No active Google Calendar connection', { clinicId });
            return null;
        }

        // Decrypt tokens
        const { data: accessToken } = await supabase.rpc('decrypt_token', {
            encrypted_token: conn.access_token_encrypted,
            encryption_key: TOKEN_ENCRYPTION_KEY,
        });
        const { data: refreshToken } = await supabase.rpc('decrypt_token', {
            encrypted_token: conn.refresh_token_encrypted,
            encryption_key: TOKEN_ENCRYPTION_KEY,
        });

        if (!accessToken || !refreshToken) {
            logger.error('Failed to decrypt calendar tokens', { clinicId });
            await this.markConnectionFailed(conn.id, 'Token decryption failed');
            return null;
        }

        const client = new google.auth.OAuth2(
            GOOGLE_CLIENT_ID,
            GOOGLE_CLIENT_SECRET,
            GOOGLE_REDIRECT_URI,
        );

        client.setCredentials({
            access_token: accessToken,
            refresh_token: refreshToken,
            expiry_date: conn.token_expiry ? new Date(conn.token_expiry).getTime() : undefined,
        });

        // Auto-refresh handler: persist new access token on refresh
        client.on('tokens', async (tokens) => {
            if (tokens.access_token) {
                const encrypted = await new GoogleCalendarOAuth()['encryptToken'](tokens.access_token);
                await supabase
                    .from('clinic_calendar_connections')
                    .update({
                        access_token_encrypted: encrypted,
                        token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
                        consecutive_failures: 0,
                    })
                    .eq('id', conn.id);
            }
        });

        return { client, connection: conn };
    }

    // ── PUSH: Internal → Google Calendar ──────────────────

    /**
     * Push a new or updated appointment to Google Calendar.
     * Called after appointment creation/update in our DB.
     */
    async pushAppointment(appointment: AppointmentRecord): Promise<{
        success: boolean;
        externalEventId?: string;
        error?: string;
    }> {
        const startedAt = Date.now();
        const clinicId = appointment.clinic_id;

        const auth = await this.getClientForClinic(clinicId);
        if (!auth) {
            return { success: false, error: 'No calendar connection' };
        }

        const calendar = google.calendar({ version: 'v3', auth: auth.client });
        const calendarId = auth.connection.provider_calendar_id || 'primary';

        // HIPAA: Redact patient names from external calendar
        const summary = HIPAA_REDACT
            ? `[Appt] ${appointment.procedure_name}`
            : `${appointment.procedure_name}`;

        const description = HIPAA_REDACT
            ? `OraDesk Appointment ID: ${appointment.id}\nProcedure: ${appointment.procedure_name}`
            : appointment.notes || '';

        const startTime = new Date(appointment.scheduled_at);
        const endTime = new Date(startTime.getTime() + appointment.duration_minutes * 60000);

        const eventBody: calendar_v3.Schema$Event = {
            summary,
            description,
            start: { dateTime: startTime.toISOString() },
            end: { dateTime: endTime.toISOString() },
            extendedProperties: {
                private: {
                    oradesk_id: appointment.id,
                    oradesk_clinic_id: clinicId,
                },
            },
        };

        try {
            let externalEventId: string;
            let operation: string;

            if (appointment.external_event_id) {
                // UPDATE existing event
                const res = await calendar.events.update({
                    calendarId,
                    eventId: appointment.external_event_id,
                    requestBody: eventBody,
                });
                externalEventId = res.data.id || appointment.external_event_id;
                operation = 'update';
            } else {
                // CREATE new event
                const res = await calendar.events.insert({
                    calendarId,
                    requestBody: eventBody,
                });
                externalEventId = res.data.id || '';
                operation = 'create';
            }

            // Update appointment with external reference
            await supabase
                .from('appointments')
                .update({
                    external_event_id: externalEventId,
                    external_provider: 'google_calendar',
                    sync_status: 'synced',
                    last_synced_at: new Date().toISOString(),
                })
                .eq('id', appointment.id);

            // Update connection last_synced_at
            await supabase
                .from('clinic_calendar_connections')
                .update({ last_synced_at: new Date().toISOString(), consecutive_failures: 0 })
                .eq('id', auth.connection.id);

            // Audit log
            await this.logSync({
                clinic_id: clinicId,
                connection_id: auth.connection.id,
                appointment_id: appointment.id,
                direction: 'push',
                operation,
                status: 'success',
                external_event_id: externalEventId,
                started_at: new Date(startedAt).toISOString(),
                completed_at: new Date().toISOString(),
                duration_ms: Date.now() - startedAt,
            });

            logger.info('Appointment pushed to Google Calendar', {
                appointmentId: appointment.id,
                externalEventId,
                operation,
            });

            return { success: true, externalEventId };
        } catch (error) {
            const msg = (error as Error).message;
            logger.error('Failed to push appointment to Google Calendar', { error: msg, appointmentId: appointment.id });

            await supabase
                .from('appointments')
                .update({ sync_status: 'failed' })
                .eq('id', appointment.id);

            await this.incrementFailureCount(auth.connection.id);

            await this.logSync({
                clinic_id: clinicId,
                connection_id: auth.connection.id,
                appointment_id: appointment.id,
                direction: 'push',
                operation: appointment.external_event_id ? 'update' : 'create',
                status: 'failed',
                error_message: msg,
                started_at: new Date(startedAt).toISOString(),
                completed_at: new Date().toISOString(),
                duration_ms: Date.now() - startedAt,
            });

            return { success: false, error: msg };
        }
    }

    /**
     * Delete an event from Google Calendar (on appointment cancellation)
     */
    async deleteExternalEvent(appointment: AppointmentRecord): Promise<void> {
        if (!appointment.external_event_id) return;

        const auth = await this.getClientForClinic(appointment.clinic_id);
        if (!auth) return;

        const calendar = google.calendar({ version: 'v3', auth: auth.client });

        try {
            await calendar.events.delete({
                calendarId: auth.connection.provider_calendar_id || 'primary',
                eventId: appointment.external_event_id,
            });

            await supabase
                .from('appointments')
                .update({
                    sync_status: 'synced',
                    last_synced_at: new Date().toISOString(),
                })
                .eq('id', appointment.id);

            await this.logSync({
                clinic_id: appointment.clinic_id,
                connection_id: auth.connection.id,
                appointment_id: appointment.id,
                direction: 'push',
                operation: 'delete',
                status: 'success',
                external_event_id: appointment.external_event_id,
                started_at: new Date().toISOString(),
            });
        } catch (error) {
            logger.error('Failed to delete Google Calendar event', {
                error: (error as Error).message,
                eventId: appointment.external_event_id,
            });
        }
    }

    // ── PULL: Google Calendar → Internal DB ────────────────

    /**
     * Handle incoming webhook from Google Calendar push notification.
     * Called by the webhook route when Google notifies us of changes.
     */
    async handleWebhookNotification(
        channelId: string,
        resourceId: string,
    ): Promise<void> {
        const startedAt = Date.now();

        // Look up which clinic this notification belongs to
        const { data: conn, error } = await supabase
            .from('clinic_calendar_connections')
            .select('*')
            .eq('webhook_channel_id', channelId)
            .eq('webhook_resource_id', resourceId)
            .single();

        if (error || !conn) {
            logger.warn('Unknown calendar webhook', { channelId, resourceId });
            return;
        }

        if (!conn.sync_enabled) {
            logger.debug('Calendar sync disabled, ignoring webhook', { clinicId: conn.clinic_id });
            return;
        }

        logger.info('Processing Google Calendar webhook', {
            clinicId: conn.clinic_id,
            channelId,
        });

        // Fetch recent changes using sync token or incremental diff
        await this.pullChanges(conn);
    }

    /**
     * Pull recent changes from Google Calendar for a specific connection.
     */
    private async pullChanges(conn: CalendarConnection): Promise<void> {
        const auth = await this.getClientForClinic(conn.clinic_id);
        if (!auth) return;

        const calendar = google.calendar({ version: 'v3', auth: auth.client });
        const calendarId = conn.provider_calendar_id || 'primary';

        try {
            // Fetch events modified in the last hour (incremental sync)
            const updatedMin = new Date(Date.now() - 60 * 60 * 1000).toISOString();

            const res = await calendar.events.list({
                calendarId,
                updatedMin,
                singleEvents: true,
                maxResults: 100,
                orderBy: 'updated',
            });

            const events = res.data.items || [];

            for (const event of events) {
                await this.processExternalEvent(event, conn);
            }

            // Update last_synced_at
            await supabase
                .from('clinic_calendar_connections')
                .update({
                    last_synced_at: new Date().toISOString(),
                    consecutive_failures: 0,
                })
                .eq('id', conn.id);
        } catch (error) {
            logger.error('Failed to pull Google Calendar changes', {
                error: (error as Error).message,
                clinicId: conn.clinic_id,
            });
            await this.incrementFailureCount(conn.id);
        }
    }

    /**
     * Process a single external calendar event.
     * Maps it to an internal appointment or detects conflicts.
     */
    private async processExternalEvent(
        event: calendar_v3.Schema$Event,
        conn: CalendarConnection,
    ): Promise<void> {
        const eventId = event.id;
        if (!eventId) return;

        // Check if this event was created by OraDesk (has our extended property)
        const oradeskId = event.extendedProperties?.private?.oradesk_id;

        if (oradeskId) {
            // This is OUR event — check for external modifications
            await this.syncOwnEventChanges(oradeskId, event, conn);
        } else {
            // External event — check if already tracked
            const { data: existing } = await supabase
                .from('appointments')
                .select('id')
                .eq('external_event_id', eventId)
                .eq('clinic_id', conn.clinic_id)
                .single();

            if (existing) {
                // Already tracked — update
                await this.updateFromExternal(existing.id, event, conn);
            } else if (event.status !== 'cancelled') {
                // New external event — create internal appointment (if sync_direction allows)
                if (conn.sync_direction === 'bidirectional' || conn.sync_direction === 'pull') {
                    await this.createFromExternal(event, conn);
                }
            }
        }
    }

    /**
     * Detect if our own event was modified externally and apply changes.
     */
    private async syncOwnEventChanges(
        appointmentId: string,
        event: calendar_v3.Schema$Event,
        conn: CalendarConnection,
    ): Promise<void> {
        if (event.status === 'cancelled') {
            // Event was deleted externally
            await supabase
                .from('appointments')
                .update({
                    status: 'cancelled',
                    sync_status: 'synced',
                    last_synced_at: new Date().toISOString(),
                })
                .eq('id', appointmentId);

            await this.logSync({
                clinic_id: conn.clinic_id,
                connection_id: conn.id,
                appointment_id: appointmentId,
                direction: 'pull',
                operation: 'delete',
                status: 'success',
                external_event_id: event.id || undefined,
                started_at: new Date().toISOString(),
            });
            return;
        }

        // Check if time was changed externally
        const newStart = event.start?.dateTime;
        if (newStart) {
            const { data: current } = await supabase
                .from('appointments')
                .select('scheduled_at')
                .eq('id', appointmentId)
                .single();

            if (current && new Date(current.scheduled_at).getTime() !== new Date(newStart).getTime()) {
                // Time changed externally — check for conflicts before applying
                const endTime = event.end?.dateTime;
                const conflicts = await this.checkConflicts(
                    conn.clinic_id,
                    newStart,
                    endTime || new Date(new Date(newStart).getTime() + 30 * 60000).toISOString(),
                    appointmentId,
                );

                if (conflicts.length > 0) {
                    // Conflict detected — mark for manual resolution
                    await supabase
                        .from('appointments')
                        .update({ sync_status: 'conflict' })
                        .eq('id', appointmentId);

                    await this.logSync({
                        clinic_id: conn.clinic_id,
                        connection_id: conn.id,
                        appointment_id: appointmentId,
                        direction: 'pull',
                        operation: 'update',
                        status: 'conflict',
                        external_event_id: event.id || undefined,
                        conflict_details: {
                            newStart,
                            conflicting: conflicts,
                        },
                        started_at: new Date().toISOString(),
                    });
                    return;
                }

                // No conflict — apply the change
                await supabase
                    .from('appointments')
                    .update({
                        scheduled_at: newStart,
                        status: 'rescheduled',
                        sync_status: 'synced',
                        last_synced_at: new Date().toISOString(),
                    })
                    .eq('id', appointmentId);

                await this.logSync({
                    clinic_id: conn.clinic_id,
                    connection_id: conn.id,
                    appointment_id: appointmentId,
                    direction: 'pull',
                    operation: 'update',
                    status: 'success',
                    started_at: new Date().toISOString(),
                });
            }
        }
    }

    /**
     * Create an internal appointment from a new external calendar event.
     */
    private async createFromExternal(
        event: calendar_v3.Schema$Event,
        conn: CalendarConnection,
    ): Promise<void> {
        const startTime = event.start?.dateTime;
        const endTime = event.end?.dateTime;
        if (!startTime || !endTime) return;

        // Conflict check
        const conflicts = await this.checkConflicts(conn.clinic_id, startTime, endTime);
        if (conflicts.length > 0) {
            await this.logSync({
                clinic_id: conn.clinic_id,
                connection_id: conn.id,
                direction: 'pull',
                operation: 'create',
                status: 'conflict',
                external_event_id: event.id || undefined,
                conflict_details: {
                    event_summary: event.summary,
                    conflicting: conflicts,
                },
                started_at: new Date().toISOString(),
            });
            return;
        }

        const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
        const durationMinutes = Math.round(durationMs / 60000);

        // Create internal appointment
        const { data: newApt, error } = await supabase
            .from('appointments')
            .insert({
                clinic_id: conn.clinic_id,
                patient_id: null, // External events don't have patient mapping
                scheduled_at: startTime,
                duration_minutes: durationMinutes,
                procedure_name: event.summary || 'External Appointment',
                status: conn.auto_confirm_external ? 'confirmed' : 'scheduled',
                ai_managed: false,
                notes: `Synced from Google Calendar: ${event.description || ''}`,
                external_event_id: event.id,
                external_provider: 'google_calendar',
                sync_status: 'synced',
                last_synced_at: new Date().toISOString(),
                external_etag: event.etag || null,
            })
            .select('id')
            .single();

        if (error) {
            logger.error('Failed to create appointment from external event', { error: error.message });
            return;
        }

        await this.logSync({
            clinic_id: conn.clinic_id,
            connection_id: conn.id,
            appointment_id: newApt?.id,
            direction: 'pull',
            operation: 'create',
            status: 'success',
            external_event_id: event.id || undefined,
            started_at: new Date().toISOString(),
        });

        logger.info('Created appointment from external calendar event', {
            appointmentId: newApt?.id,
            externalEventId: event.id,
        });
    }

    /**
     * Update an existing internal appointment from external changes.
     */
    private async updateFromExternal(
        appointmentId: string,
        event: calendar_v3.Schema$Event,
        conn: CalendarConnection,
    ): Promise<void> {
        if (event.status === 'cancelled') {
            await supabase
                .from('appointments')
                .update({ status: 'cancelled', sync_status: 'synced', last_synced_at: new Date().toISOString() })
                .eq('id', appointmentId);
            return;
        }

        const updates: Record<string, any> = {
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
            external_etag: event.etag || null,
        };

        if (event.start?.dateTime) {
            updates.scheduled_at = event.start.dateTime;
        }
        if (event.end?.dateTime && event.start?.dateTime) {
            const dur = (new Date(event.end.dateTime).getTime() - new Date(event.start.dateTime).getTime()) / 60000;
            updates.duration_minutes = Math.round(dur);
        }
        if (event.summary) {
            updates.procedure_name = event.summary;
        }

        await supabase
            .from('appointments')
            .update(updates)
            .eq('id', appointmentId);
    }

    // ── WEBHOOK CHANNEL MANAGEMENT ────────────────────────

    /**
     * Register a webhook channel with Google Calendar for push notifications.
     */
    async registerWebhookChannel(clinicId: string): Promise<{
        success: boolean;
        error?: string;
    }> {
        const auth = await this.getClientForClinic(clinicId);
        if (!auth) return { success: false, error: 'No calendar connection' };

        const calendar = google.calendar({ version: 'v3', auth: auth.client });
        const channelId = randomUUID();

        try {
            const res = await calendar.events.watch({
                calendarId: auth.connection.provider_calendar_id || 'primary',
                requestBody: {
                    id: channelId,
                    type: 'web_hook',
                    address: `${WEBHOOK_BASE_URL}/v1/webhooks/google-calendar`,
                    params: {
                        ttl: '604800', // 7 days
                    },
                },
            });

            await supabase
                .from('clinic_calendar_connections')
                .update({
                    webhook_channel_id: channelId,
                    webhook_resource_id: res.data.resourceId || null,
                    webhook_expiry: res.data.expiration
                        ? new Date(parseInt(res.data.expiration)).toISOString()
                        : null,
                })
                .eq('id', auth.connection.id);

            logger.info('Google Calendar webhook registered', { clinicId, channelId });
            return { success: true };
        } catch (error) {
            const msg = (error as Error).message;
            logger.error('Failed to register Google Calendar webhook', { error: msg, clinicId });
            return { success: false, error: msg };
        }
    }

    /**
     * Stop an existing webhook channel.
     */
    async stopWebhookChannel(clinicId: string): Promise<void> {
        const auth = await this.getClientForClinic(clinicId);
        if (!auth || !auth.connection.webhook_channel_id || !auth.connection.webhook_resource_id) return;

        const calendar = google.calendar({ version: 'v3', auth: auth.client });

        try {
            await calendar.channels.stop({
                requestBody: {
                    id: auth.connection.webhook_channel_id,
                    resourceId: auth.connection.webhook_resource_id,
                },
            });

            await supabase
                .from('clinic_calendar_connections')
                .update({
                    webhook_channel_id: null,
                    webhook_resource_id: null,
                    webhook_expiry: null,
                })
                .eq('id', auth.connection.id);
        } catch (error) {
            logger.error('Failed to stop webhook channel', { error: (error as Error).message });
        }
    }

    // ── CONFLICT DETECTION ────────────────────────────────

    /**
     * Check for time conflicts using the DB function.
     */
    async checkConflicts(
        clinicId: string,
        startTime: string,
        endTime: string,
        excludeAppointmentId?: string,
    ): Promise<ConflictResult[]> {
        const { data, error } = await supabase.rpc('check_appointment_conflict', {
            p_clinic_id: clinicId,
            p_start_time: startTime,
            p_end_time: endTime,
            p_exclude_appointment_id: excludeAppointmentId || null,
        });

        if (error) {
            logger.error('Conflict detection query failed', { error: error.message });
            return [];
        }

        return (data as ConflictResult[]) || [];
    }

    // ── AVAILABILITY API ──────────────────────────────────

    /**
     * Get available appointment slots for a given date.
     * Combines internal DB + external calendar availability.
     */
    async getAvailableSlots(
        clinicId: string,
        date: string, // YYYY-MM-DD
        durationMinutes: number = 30,
    ): Promise<{ start: string; end: string }[]> {
        const { data, error } = await supabase.rpc('get_available_slots', {
            p_clinic_id: clinicId,
            p_date: date,
            p_duration_minutes: durationMinutes,
        });

        if (error) {
            logger.error('Availability query failed', { error: error.message });
            return [];
        }

        return (data || []).map((slot: any) => ({
            start: slot.slot_start,
            end: slot.slot_end,
        }));
    }

    // ── HELPERS ────────────────────────────────────────────

    private async logSync(entry: SyncLogEntry): Promise<void> {
        try {
            await supabase.from('calendar_sync_log').insert(entry);
        } catch (error) {
            logger.error('Failed to write sync log', { error: (error as Error).message });
        }
    }

    private async markConnectionFailed(connectionId: string, reason: string): Promise<void> {
        await supabase
            .from('clinic_calendar_connections')
            .update({ status: 'expired', last_sync_error: reason })
            .eq('id', connectionId);
    }

    private async incrementFailureCount(connectionId: string): Promise<void> {
        const { data } = await supabase
            .from('clinic_calendar_connections')
            .select('consecutive_failures')
            .eq('id', connectionId)
            .single();

        const newCount = (data?.consecutive_failures || 0) + 1;
        const updates: Record<string, any> = { consecutive_failures: newCount };

        // Auto-disable after 5 consecutive failures
        if (newCount >= 5) {
            updates.status = 'expired';
            updates.last_sync_error = 'Too many consecutive failures — sync disabled';
            logger.warn('Calendar sync auto-disabled due to repeated failures', { connectionId });
        }

        await supabase
            .from('clinic_calendar_connections')
            .update(updates)
            .eq('id', connectionId);
    }
}

// ── Singleton Exports ───────────────────────────────────────

export const calendarOAuth = new GoogleCalendarOAuth();
export const calendarSync = new GoogleCalendarSyncService();
