/**
 * AI TOOL DEFINITIONS
 *
 * JSON Schema definitions for tools the AI receptionist can invoke.
 * These are passed to Gemini as function declarations so the model
 * knows what actions it can take in real-time during a call.
 *
 * Tool Architecture:
 * - definitions.ts (this file) → Schema + types
 * - executor.ts → Actual database logic
 *
 * Tools:
 * 1. checkAvailability — Query real PMS slots from Supabase
 * 2. bookAppointment — Lock a slot and create a booking record
 * 3. escalateToHuman — Flag call for immediate human takeover
 */

// ── Tool Call Types ─────────────────────────────────────────

export interface ToolCallRequest {
  name: 'checkAvailability' | 'bookAppointment' | 'escalateToHuman' | 'checkGoogleCalendar' | 'searchKnowledgeBase';
  arguments:
  | CheckAvailabilityArgs
  | BookAppointmentArgs
  | EscalateToHumanArgs
  | CheckGoogleCalendarArgs
  | SearchKnowledgeBaseArgs;
}

export interface CheckAvailabilityArgs {
  date: string; // ISO date string (e.g., "2026-02-18")
  timePreference?: 'morning' | 'afternoon' | 'evening' | 'any';
  clinicId: string; // UUID of the clinic
}

export interface BookAppointmentArgs {
  slotId: string; // UUID of the pms_slots row to lock
  patientId: string; // UUID of the patient
  reason: string; // e.g., "Routine Cleaning", "Check-up", "Follow-up"
  callId: string; // UUID of the ai_calls row (for audit trail)
  clinicId: string; // UUID of the clinic
}

export interface EscalateToHumanArgs {
  reason: string; // Human-readable reason for escalation
  sentiment: 'frustrated' | 'angry' | 'emergency' | 'request';
  callId: string; // UUID of the ai_calls row
  clinicId: string; // UUID of the clinic
  patientId: string; // UUID of the patient
}

export interface CheckGoogleCalendarArgs {
  date: string;
  timePreference?: 'morning' | 'afternoon' | 'evening' | 'any';
  clinicId: string;
}

export interface SearchKnowledgeBaseArgs {
  query: string;
  clinicId: string;
}

// ── Tool Results ────────────────────────────────────────────

export interface AvailableSlot {
  slotId: string;
  providerId: string;
  startTime: string; // ISO datetime
  endTime: string; // ISO datetime
  displayTime: string; // Human-readable, e.g., "Tuesday 2:30 PM"
}

export interface CheckAvailabilityResult {
  success: boolean;
  slots: AvailableSlot[];
  message: string; // Natural language summary for the AI
}

export interface BookAppointmentResult {
  success: boolean;
  confirmationCode: string | null;
  bookedSlot: AvailableSlot | null;
  message: string; // Natural language result for the AI
}

export interface EscalateToHumanResult {
  success: boolean;
  taskId: string | null;
  message: string;
}

export interface CheckGoogleCalendarResult {
  success: boolean;
  slots: { start: string; end: string }[];
  message: string;
}

export interface SearchKnowledgeBaseResult {
  success: boolean;
  documents: { content: string; similarity: number }[];
  message: string;
}

export type ToolResult =
  | CheckAvailabilityResult
  | BookAppointmentResult
  | EscalateToHumanResult
  | CheckGoogleCalendarResult
  | SearchKnowledgeBaseResult;

// ── Gemini Function Declarations ────────────────────────────
// These are the JSON schemas Gemini uses to understand available tools.

export const TOOL_DECLARATIONS = [
  {
    name: 'checkAvailability',
    description:
      'Check available appointment slots at the clinic for a specific date. ' +
      'Returns a list of open time slots the patient can choose from. ' +
      'Use this when the patient asks about availability or wants to reschedule.',
    parameters: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description:
            'The date to check availability for, in ISO format (YYYY-MM-DD). ' +
            'If patient says "tomorrow", calculate the actual date. ' +
            'If patient says "kal", that also means "tomorrow".',
        },
        timePreference: {
          type: 'string',
          enum: ['morning', 'afternoon', 'evening', 'any'],
          description:
            'Time of day preference. ' +
            '"subah" = morning, "dopahar" = afternoon, "shaam" = evening.',
        },
        clinicId: {
          type: 'string',
          description: 'The clinic UUID. This is provided in the call context.',
        },
      },
      required: ['date', 'clinicId'],
    },
  },
  {
    name: 'bookAppointment',
    description:
      'Book a confirmed appointment for the patient. ' +
      'This locks the slot in the system and creates a booking record. ' +
      'IMPORTANT: Always confirm the time with the patient BEFORE calling this tool. ' +
      'Say "Just to confirm, I\'ll book you for [time]. Does that work?" and wait for yes.',
    parameters: {
      type: 'object' as const,
      properties: {
        slotId: {
          type: 'string',
          description: 'The UUID of the chosen slot from checkAvailability results.',
        },
        patientId: {
          type: 'string',
          description: 'The patient UUID. This is provided in the call context.',
        },
        reason: {
          type: 'string',
          description:
            'Reason for the appointment, e.g., "Routine Cleaning", "Check-up", "Tooth Pain Follow-up".',
        },
        callId: {
          type: 'string',
          description: 'The current call UUID for audit trail. Provided in context.',
        },
        clinicId: {
          type: 'string',
          description: 'The clinic UUID. Provided in the call context.',
        },
      },
      required: ['slotId', 'patientId', 'reason', 'callId', 'clinicId'],
    },
  },
  {
    name: 'escalateToHuman',
    description:
      'Transfer the call to a human staff member. ' +
      'Use when: patient is angry, requests a real person, or an emergency is detected. ' +
      'This creates an urgent staff task and flags the call for immediate attention.',
    parameters: {
      type: 'object' as const,
      properties: {
        reason: {
          type: 'string',
          description:
            'Why the escalation is needed. Be specific, e.g., "Patient is angry about billing" or "Emergency: patient reporting severe pain".',
        },
        sentiment: {
          type: 'string',
          enum: ['frustrated', 'angry', 'emergency', 'request'],
          description: 'The detected sentiment triggering escalation.',
        },
        callId: {
          type: 'string',
          description: 'Current call UUID.',
        },
        clinicId: {
          type: 'string',
          description: 'Clinic UUID.',
        },
        patientId: {
          type: 'string',
          description: 'Patient UUID.',
        },
      },
      required: ['reason', 'sentiment', 'callId', 'clinicId', 'patientId'],
    },
  },
  {
    name: 'checkGoogleCalendar',
    description:
      'Check availability on the clinic\'s official Google Calendar. ' +
      'Use this when the patient asks for specific dates and you need to see if there are conflicts. ' +
      'Returns a list of FREE slots.',
    parameters: {
      type: 'object' as const,
      properties: {
        date: {
          type: 'string',
          description: 'ISO date string (YYYY-MM-DD) to check.',
        },
        timePreference: {
          type: 'string',
          enum: ['morning', 'afternoon', 'evening', 'any'],
          description: 'Time of day preference.',
        },
        clinicId: {
          type: 'string',
          description: 'Clinic UUID.',
        },
      },
      required: ['date', 'clinicId'],
    },
  },
  {
    name: 'searchKnowledgeBase',
    description:
      'Search the clinic\'s knowledge base for policies, pricing, and general information. ' +
      'Use this when you don\'t know the answer to a specific question about the clinic (e.g., "Do you take Medicaid?", "How much is a crown?"). ' +
      'Do NOT use for appointment availability.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'The search query, e.g., "accepted insurance", "root canal price".',
        },
        clinicId: {
          type: 'string',
          description: 'Clinic UUID.',
        },
      },
      required: ['query', 'clinicId'],
    },
  },
];

/**
 * Parse a tool call from the AI's JSON response.
 * Returns null if no valid tool call is present.
 */
export function parseToolCall(
  toolCallRaw: { name: string; arguments: Record<string, unknown> } | null | undefined,
): ToolCallRequest | null {
  if (!toolCallRaw || !toolCallRaw.name) return null;

  const { name, arguments: args } = toolCallRaw;

  switch (name) {
    case 'checkAvailability':
      return {
        name: 'checkAvailability',
        arguments: {
          date: String(args.date || ''),
          timePreference: (args.timePreference as CheckAvailabilityArgs['timePreference']) || 'any',
          clinicId: String(args.clinicId || ''),
        } satisfies CheckAvailabilityArgs,
      };

    case 'bookAppointment':
      return {
        name: 'bookAppointment',
        arguments: {
          slotId: String(args.slotId || ''),
          patientId: String(args.patientId || ''),
          reason: String(args.reason || 'Dental Visit'),
          callId: String(args.callId || ''),
          clinicId: String(args.clinicId || ''),
        } satisfies BookAppointmentArgs,
      };

    case 'escalateToHuman':
      return {
        name: 'escalateToHuman',
        arguments: {
          reason: String(args.reason || 'Patient requested human'),
          sentiment: (args.sentiment as EscalateToHumanArgs['sentiment']) || 'request',
          callId: String(args.callId || ''),
          clinicId: String(args.clinicId || ''),
          patientId: String(args.patientId || ''),
        } satisfies EscalateToHumanArgs,
      };

    case 'checkGoogleCalendar':
      return {
        name: 'checkGoogleCalendar',
        arguments: {
          date: String(args.date || ''),
          timePreference: (args.timePreference as CheckGoogleCalendarArgs['timePreference']) || 'any',
          clinicId: String(args.clinicId || ''),
        } satisfies CheckGoogleCalendarArgs,
      };

    case 'searchKnowledgeBase':
      return {
        name: 'searchKnowledgeBase',
        arguments: {
          query: String(args.query || ''),
          clinicId: String(args.clinicId || ''),
        } satisfies SearchKnowledgeBaseArgs,
      };

    default:
      return null;
  }
}
