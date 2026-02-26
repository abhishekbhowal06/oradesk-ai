/**
 * ZOD VALIDATION SCHEMAS
 *
 * Centralized input validation for all route handlers.
 * Eliminates untrusted input reaching database queries.
 */

import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// ── Shared Primitives ──────────────────────────────────────

const uuid = z.string().uuid('Invalid UUID format');
const phone = z.string().regex(/^\+?[1-9]\d{6,14}$/, 'Invalid phone number');
const isoDate = z.string().datetime({ message: 'Invalid ISO date' }).optional();
const positiveInt = z.coerce.number().int().positive();

// ── Route Schemas ──────────────────────────────────────────

/** POST /v1/calls (outbound) */
export const OutboundCallSchema = z.object({
    appointment_id: uuid.optional(),
    patient_id: uuid.optional(),
    call_type: z.enum(['confirmation', 'recall', 'followup', 'manual']).default('confirmation'),
}).refine(data => data.appointment_id || data.patient_id, {
    message: 'Either appointment_id or patient_id is required',
});

/** POST /v1/campaigns/upload */
export const CampaignUploadSchema = z.object({
    csv_content: z.string().min(1, 'CSV content required').max(5_000_000, 'CSV exceeds 5MB limit'),
});

/** POST /v1/recall/initiate */
export const RecallInitiateSchema = z.object({
    patient_ids: z.array(uuid).min(1, 'At least one patient_id required').max(500, 'Max 500 per batch'),
});

/** POST /v1/appointments/request (widget) */
export const WidgetAppointmentSchema = z.object({
    first_name: z.string().min(1).max(100).trim(),
    last_name: z.string().min(1).max(100).trim(),
    phone: phone,
    reason: z.enum(['cleaning', 'pain', 'cosmetic', 'followup', 'other']).default('other'),
    notes: z.string().max(1000).optional(),
});

/** POST /v1/automation/pause */
export const AutomationPauseSchema = z.object({
    reason: z.string().max(500).optional(),
});

/** POST /v1/billing/checkout */
export const BillingCheckoutSchema = z.object({
    tier: z.enum(['starter', 'growth', 'professional', 'enterprise']),
});

/** POST /v1/bridge/write */
export const BridgeWriteSchema = z.object({
    operation: z.enum(['create_appointment', 'update_appointment', 'create_patient', 'update_patient']),
    oradesk_id: uuid.optional(),
    pms_id: z.string().optional(),
    payload: z.record(z.string(), z.unknown()),
});

/** POST /v1/calendar/check-conflicts */
export const CalendarConflictSchema = z.object({
    start_time: z.string().datetime(),
    end_time: z.string().datetime(),
    exclude_appointment_id: uuid.optional(),
});

/** POST /v1/data/patient/:patientId/delete */
export const DataDeletionSchema = z.object({
    reason: z.string().min(1).max(500).default('GDPR erasure request'),
});

/** POST /v1/data/export */
export const DataExportSchema = z.object({
    patient_id: uuid.optional(),
});

/** GET /v1/recall/candidates — query params */
export const RecallCandidatesQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** GET /v1/analytics — query params */
export const AnalyticsQuerySchema = z.object({
    period: z.enum(['today', 'week', 'month', 'quarter', 'year']).default('month'),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// ── Validation Middleware Factory ───────────────────────────

/**
 * Creates Express middleware that validates `req.body` against a Zod schema.
 * On failure: returns 400 with structured error details.
 */
export function validateBody<T extends z.ZodType>(schema: T) {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: result.error.issues.map(i => ({
                    field: i.path.join('.'),
                    message: i.message,
                })),
            });
        }
        req.body = result.data;
        next();
    };
}

/**
 * Creates Express middleware that validates `req.query` against a Zod schema.
 */
export function validateQuery<T extends z.ZodType>(schema: T) {
    return (req: Request, res: Response, next: NextFunction) => {
        const result = schema.safeParse(req.query);
        if (!result.success) {
            return res.status(400).json({
                error: 'Query validation failed',
                details: result.error.issues.map(i => ({
                    field: i.path.join('.'),
                    message: i.message,
                })),
            });
        }
        // Merge validated data back (coerced types)
        Object.assign(req.query, result.data);
        next();
    };
}
