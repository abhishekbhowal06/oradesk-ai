import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// UUID validation pattern
const uuidSchema = z.string().uuid('Invalid UUID format');

// E.164 phone number format validation
const phoneSchema = z.string()
  .min(10, 'Phone number too short')
  .max(15, 'Phone number too long')
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format (expected E.164)');

// Email validation
const emailSchema = z.string().email('Invalid email format').max(255, 'Email too long');

// Text message content validation
const messageSchema = z.string()
  .min(1, 'Message cannot be empty')
  .max(1600, 'Message too long (max 1600 characters)');

// Call request schema
export const CallRequestSchema = z.object({
  action: z.enum(['initiate', 'status', 'complete']),
  patientId: uuidSchema,
  clinicId: uuidSchema,
  phoneNumber: phoneSchema,
  appointmentId: uuidSchema.optional(),
  callType: z.enum(['confirmation', 'reminder', 'follow_up']).optional(),
  callSid: z.string().optional(),
  outcome: z.enum(['confirmed', 'rescheduled', 'cancelled', 'action_needed', 'unreachable']).optional(),
  transcript: z.array(z.object({
    role: z.string(),
    message: z.string(),
    timestamp: z.string(),
  })).optional(),
  confidenceScore: z.number().min(0).max(100).optional(),
  aiReasoning: z.string().max(500).optional(),
});

export type ValidatedCallRequest = z.infer<typeof CallRequestSchema>;

// Send notification schema
export const NotificationRequestSchema = z.object({
  clinicId: uuidSchema,
  patientId: uuidSchema.optional(),
  type: z.enum(['email', 'sms']),
  template: z.enum(['appointment_reminder', 'appointment_confirmed', 'follow_up_needed', 'custom']),
  data: z.object({
    to: z.string().min(1, 'Recipient is required'),
    subject: z.string().max(200, 'Subject too long').optional(),
    message: messageSchema,
    patientName: z.string().max(100).optional(),
    appointmentDate: z.string().optional(),
    appointmentTime: z.string().optional(),
  }),
});

export type ValidatedNotificationRequest = z.infer<typeof NotificationRequestSchema>;

// ElevenLabs token request schema  
export const ElevenLabsTokenRequestSchema = z.object({
  clinicId: uuidSchema,
});

export type ValidatedElevenLabsRequest = z.infer<typeof ElevenLabsTokenRequestSchema>;

/**
 * Validates and sanitizes input. Throws a descriptive error if validation fails.
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
    throw new Error(`Validation failed: ${errors}`);
  }
  return result.data;
}

/**
 * Sanitizes a string for safe output (removes potential XSS vectors).
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
