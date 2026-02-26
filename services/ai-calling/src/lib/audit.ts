/**
 * AUDIT LOGGING MODULE
 * 
 * Provides an immutable record of administrative and destructive actions
 * to satisfy SOC2 Type II and HIPAA access tracking requirements.
 * 
 * Writes directly to the `audit_logs` table using the `supabaseAdmin` client.
 */

import { supabaseAdmin } from './supabase';
import { logger } from './logging/structured-logger';

export interface AuditLogEntry {
    clinicId: string;
    actorId: string;
    action: string;
    resource: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
}

/**
 * Records an immutable audit log entry in the database.
 * Does not throw errors to prevent blocking the main business transaction,
 * but drops an error log if the insertion fails.
 */
export async function logAdminAction(entry: AuditLogEntry): Promise<void> {
    try {
        const { error } = await supabaseAdmin.from('audit_logs').insert({
            clinic_id: entry.clinicId,
            actor_id: entry.actorId,
            action: entry.action,
            resource: entry.resource,
            metadata: entry.metadata || {},
            ip_address: entry.ipAddress || null,
        });

        if (error) {
            logger.error('Failed to write audit log to database', {
                action: entry.action,
                error: error.message
            });
        }
    } catch (err) {
        logger.error('Exception while writing audit log', {
            action: entry.action,
            error: err instanceof Error ? err.message : 'Unknown'
        });
    }
}
