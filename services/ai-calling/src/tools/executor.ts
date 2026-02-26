/**
 * AI TOOL EXECUTOR
 *
 * Executes tool calls made by the AI receptionist during live calls.
 * These functions run REAL Supabase queries against the production database.
 *
 * Architecture:
 * 1. AI generates a tool_call in its JSON response
 * 2. definitions.ts parses it into a typed ToolCallRequest
 * 3. THIS FILE executes the actual database operation
 * 4. Result is fed back to the AI as context for its next response
 *
 * Error Philosophy:
 * - NEVER return raw errors to the AI. Always return natural language.
 * - The AI sees "Our system is taking a moment" — not "PGRST116".
 * - Log the real error internally for debugging.
 */

import { supabase } from '../lib/supabase';
import { logger } from '../lib/logging/structured-logger';
import { withLock } from '../lib/distributed-lock';
import {
  ToolCallRequest,
  CheckAvailabilityArgs,
  BookAppointmentArgs,
  EscalateToHumanArgs,
  CheckAvailabilityResult,
  BookAppointmentResult,
  EscalateToHumanResult,
  CheckGoogleCalendarArgs,
  CheckGoogleCalendarResult,
  AvailableSlot,
  ToolResult,
  SearchKnowledgeBaseArgs,
  SearchKnowledgeBaseResult,
} from './definitions';
import { appointmentService } from '../services/data/AppointmentService';
import { knowledgeService } from '../services/knowledge-service';

// ── Main Dispatcher ────────────────────────────────────────

/**
 * Execute a tool call from the AI and return a result the AI can use.
 */
export async function executeTool(toolCall: ToolCallRequest): Promise<ToolResult> {
  logger.info('Executing AI tool', { tool: toolCall.name, args: toolCall.arguments });

  try {
    switch (toolCall.name) {
      case 'checkAvailability':
        return await executeCheckAvailability(toolCall.arguments as CheckAvailabilityArgs);
      case 'bookAppointment':
        return await executeBookAppointment(toolCall.arguments as BookAppointmentArgs);
      case 'escalateToHuman':
        return await executeEscalateToHuman(toolCall.arguments as EscalateToHumanArgs);
      case 'checkGoogleCalendar':
        return await executeCheckGoogleCalendar(toolCall.arguments as CheckGoogleCalendarArgs);
      case 'searchKnowledgeBase':
        return await executeSearchKnowledgeBase(toolCall.arguments as SearchKnowledgeBaseArgs);
      default:
        return {
          success: false,
          slots: [],
          message: 'I encountered an issue. Let me connect you with our team.',
        } satisfies CheckAvailabilityResult;
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Tool execution failed', { tool: toolCall.name, error: errMsg });

    // Return graceful failure — AI never sees technical errors
    return {
      success: false,
      slots: [],
      message: 'Our system is taking a moment to respond. Let me try a different way to help you.',
    } satisfies CheckAvailabilityResult;
  }
}

// ── Tool 1: Check Availability ─────────────────────────────

async function executeCheckAvailability(
  args: CheckAvailabilityArgs,
): Promise<CheckAvailabilityResult> {
  const { date, timePreference, clinicId } = args;

  if (!clinicId || !date) {
    return {
      success: false,
      slots: [],
      message: 'I need a bit more info to check our schedule. What date works best for you?',
    };
  }

  // Prepare range
  const searchDate = new Date(`${date}T00:00:00Z`);
  const dateStart = new Date(searchDate);
  const dateEnd = new Date(searchDate);

  // Naive time preference mapping (can be smarter)
  if (timePreference === 'morning') {
    dateStart.setUTCHours(8, 0, 0, 0);
    dateEnd.setUTCHours(12, 0, 0, 0);
  } else if (timePreference === 'afternoon') {
    dateStart.setUTCHours(12, 0, 0, 0);
    dateEnd.setUTCHours(17, 0, 0, 0);
  } else if (timePreference === 'evening') {
    dateStart.setUTCHours(17, 0, 0, 0);
    dateEnd.setUTCHours(21, 0, 0, 0);
  } else {
    dateStart.setUTCHours(8, 0, 0, 0);
    dateEnd.setUTCHours(21, 0, 0, 0);
  }

  // Use Service Layer
  const slots = await appointmentService.findAvailableSlots(clinicId, dateStart, dateEnd);

  if (slots.length === 0) {
    return {
      success: true,
      slots: [],
      message: `I don't have any openings on that date/time. Would you like to check another day?`,
    };
  }

  // Format for AI
  const formattedSlots: AvailableSlot[] = slots.map((slot) => ({
    slotId: slot.id,
    providerId: slot.provider_id,
    startTime: slot.start_time,
    endTime: slot.end_time,
    displayTime: formatDisplayTime(slot.start_time),
  }));

  const slotDescriptions = formattedSlots
    .slice(0, 3)
    .map((s, i) => `${i + 1}. ${s.displayTime}`)
    .join(', ');

  return {
    success: true,
    slots: formattedSlots.slice(0, 3),
    message: `Great news! I have openings: ${slotDescriptions}. Which one works best?`,
  };
}

// ── Tool 2: Book Appointment ────────────────────────────────

async function executeBookAppointment(args: BookAppointmentArgs): Promise<BookAppointmentResult> {
  const { slotId, patientId, reason, callId, clinicId } = args;

  if (!slotId || !patientId || !clinicId) {
    return {
      success: false,
      confirmationCode: null,
      bookedSlot: null,
      message: 'I need a few more details to complete the booking. Let me try again.',
    };
  }

  const lockKey = `booking_lock:${clinicId}:${slotId}`;

  // Use Distributed Lock to prevent race conditions
  return await withLock(
    lockKey,
    async () => {
      // Use Service Layer
      const result = await appointmentService.bookSlot(clinicId, slotId, patientId, callId, reason);

      if (!result.success || !result.slot) {
        return {
          success: false,
          confirmationCode: null,
          bookedSlot: null,
          message: result.error || 'I had a small hiccup booking that. Let me try one more time.',
        };
      }

      // Generate confirmation code (should be in service, but keeping here for now)
      const confirmationCode = `DC-${result.bookingId?.substring(0, 8).toUpperCase()}`;

      const bookedSlot: AvailableSlot = {
        slotId: result.slot.id,
        providerId: result.slot.provider_id,
        startTime: result.slot.start_time,
        endTime: result.slot.end_time,
        displayTime: formatDisplayTime(result.slot.start_time),
      };

      return {
        success: true,
        confirmationCode,
        bookedSlot,
        message: `You're all set! I've booked you for ${bookedSlot.displayTime}. Your confirmation code is ${confirmationCode}.`,
      };
    },
    { skipIfLocked: true }
  ) || {
    // If lock acquisition failed (skipped because locked)
    success: false,
    confirmationCode: null,
    bookedSlot: null,
    message: "It looks like someone just grabbed that spot. Let's check for another time.",
  };
}

// ── Tool 3: Escalate to Human ──────────────────────────────

async function executeEscalateToHuman(args: EscalateToHumanArgs): Promise<EscalateToHumanResult> {
  const { reason, sentiment, callId, clinicId, patientId } = args;

  const priority = sentiment === 'emergency' ? 'urgent' : sentiment === 'angry' ? 'urgent' : 'high';

  // Create staff task for immediate attention
  const { data: task, error: taskError } = await supabase
    .from('staff_tasks')
    .insert({
      clinic_id: clinicId,
      patient_id: patientId,
      ai_call_id: callId,
      title: `${sentiment === 'emergency' ? '🔴 EMERGENCY' : '⚠️ ESCALATION'}: Patient requires human attention`,
      description: `AI receptionist escalated this call.\nReason: ${reason}\nSentiment: ${sentiment}`,
      priority,
      ai_generated: true,
    })
    .select('id')
    .single();

  if (taskError) {
    logger.error('Failed to create escalation task', { error: taskError.message });
  }

  // Flag the call record
  await supabase
    .from('ai_calls')
    .update({
      escalation_required: true,
      escalation_reason: reason,
      outcome: 'action_needed',
    })
    .eq('id', callId);

  // Log analytics
  await supabase.from('analytics_events').insert({
    clinic_id: clinicId,
    event_type: 'staff_action',
    patient_id: patientId,
    ai_call_id: callId,
    event_data: {
      action: 'ai_escalation',
      reason,
      sentiment,
      task_id: task?.id,
    },
  });

  return {
    success: true,
    taskId: task?.id || null,
    message:
      "I'm connecting you with our team right now. They'll be able to help you directly. Please stay on the line.",
  };
}

// ── Date Formatting Helpers ────────────────────────────────

function formatDisplayTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    // Use Intl.DateTimeFormat for better localization support
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      hour: 'numeric',
      minute: 'numeric',
      timeZone: 'America/New_York',
      timeZoneName: 'short'
    }).format(date);
  } catch {
    return isoString;
  }
}

function formatDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    }).format(date);
  } catch {
    return isoDate;
  }
}

// ── Tool 4: Check Google Calendar ──────────────────────────

async function executeCheckGoogleCalendar(
  args: CheckGoogleCalendarArgs
): Promise<CheckGoogleCalendarResult> {
  const { date, timePreference, clinicId } = args;

  // TODO: Retrieve credentials from DB based on clinicId
  // const credentials = await getClinicIntegrations(clinicId);

  // For now, return a graceful "Not Configured" message that the AI can explain
  // This allows the code to exist without breaking the build
  return {
    success: false,
    slots: [],
    message: "Google Calendar is not yet connected for this clinic. Please use the standard system availability check.",
  };
}

// ── Tool 5: Search Knowledge Base ──────────────────────────

async function executeSearchKnowledgeBase(
  args: SearchKnowledgeBaseArgs,
): Promise<SearchKnowledgeBaseResult> {
  const { query, clinicId } = args;

  if (!query || !clinicId) {
    return {
      success: false,
      documents: [],
      message: "I didn't catch what you wanted to search for. Could you please repeat that?",
    };
  }

  const results = await knowledgeService.search(clinicId, query);

  if (results.length === 0) {
    return {
      success: true,
      documents: [],
      message: "I couldn't find any specific information on that in our records.",
    };
  }

  // Format relevant documents for the AI to "read"
  const docs = results.map((r) => ({
    content: r.content,
    similarity: r.similarity || 0,
  }));

  return {
    success: true,
    documents: docs,
    message: `Found ${docs.length} relevant entries. Use this context to answer the patient.`,
  };
}

