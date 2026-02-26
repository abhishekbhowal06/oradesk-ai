/**
 * Conversation State Machine
 *
 * Replaces prompt-only AI behavior with deterministic state transitions.
 * Ensures predictable, auditable conversation flow.
 */

import { logger } from './logging/structured-logger';
import { checkEmergency, SafetyCheckResult } from './safety-boundaries';

// Conversation states
export enum ConversationState {
  GREETING = 'greeting',
  LISTENING = 'listening',
  CONFIRMING = 'confirming',
  RESCHEDULING = 'rescheduling',
  CANCELLING = 'cancelling',
  CLARIFYING = 'clarifying',
  ESCALATING = 'escalating',
  COMPLETED = 'completed',
  EMERGENCY = 'emergency',
}

// Intent types
export type Intent =
  | 'confirm'
  | 'reschedule'
  | 'cancel'
  | 'question'
  | 'complaint'
  | 'emergency'
  | 'greeting'
  | 'unclear';

// Conversation context stored per call
export interface ConversationContext {
  callId: string;
  state: ConversationState;
  turnCount: number;
  maxTurns: number;
  appointmentId?: string;
  patientName: string;
  appointmentDate?: string;
  procedureName?: string;
  intents: Intent[];
  lastIntent?: Intent;
  clarificationAttempts: number;
  maxClarificationAttempts: number;
  escalationReasons: string[];
  transcript: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
}

// State machine responses
export interface StateResponse {
  newState: ConversationState;
  responseText: string;
  shouldHangup: boolean;
  requiresHuman: boolean;
  escalationReason?: string;
}

// Valid state transitions
const VALID_TRANSITIONS: Record<ConversationState, ConversationState[]> = {
  [ConversationState.GREETING]: [ConversationState.LISTENING, ConversationState.EMERGENCY],
  [ConversationState.LISTENING]: [
    ConversationState.COMPLETED, // Direct confirm
    ConversationState.CONFIRMING,
    ConversationState.RESCHEDULING,
    ConversationState.CANCELLING,
    ConversationState.CLARIFYING,
    ConversationState.ESCALATING,
    ConversationState.EMERGENCY,
  ],
  [ConversationState.CONFIRMING]: [
    ConversationState.COMPLETED,
    ConversationState.RESCHEDULING,
    ConversationState.CLARIFYING,
    ConversationState.EMERGENCY,
  ],
  [ConversationState.RESCHEDULING]: [
    ConversationState.ESCALATING,
    ConversationState.COMPLETED,
    ConversationState.EMERGENCY,
  ],
  [ConversationState.CANCELLING]: [
    ConversationState.ESCALATING,
    ConversationState.COMPLETED,
    ConversationState.EMERGENCY,
  ],
  [ConversationState.CLARIFYING]: [
    ConversationState.LISTENING,
    ConversationState.ESCALATING,
    ConversationState.EMERGENCY,
  ],
  [ConversationState.ESCALATING]: [ConversationState.COMPLETED],
  [ConversationState.COMPLETED]: [],
  [ConversationState.EMERGENCY]: [ConversationState.COMPLETED],
};

/**
 * Create initial conversation context
 */
export function createConversationContext(
  callId: string,
  patientName: string,
  appointmentId?: string,
  appointmentDate?: string,
  procedureName?: string,
): ConversationContext {
  return {
    callId,
    state: ConversationState.GREETING,
    turnCount: 0,
    maxTurns: 10,
    appointmentId,
    patientName,
    appointmentDate,
    procedureName,
    intents: [],
    clarificationAttempts: 0,
    maxClarificationAttempts: 2,
    escalationReasons: [],
    transcript: [],
  };
}

/**
 * Check if state transition is valid
 */
function isValidTransition(from: ConversationState, to: ConversationState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) || false;
}

/**
 * Transition to new state with validation
 */
function transitionTo(
  context: ConversationContext,
  newState: ConversationState,
  reason?: string,
): void {
  if (!isValidTransition(context.state, newState)) {
    logger.warn('Invalid state transition attempted', {
      callId: context.callId,
      from: context.state,
      to: newState,
    });
    // Force to escalation on invalid transition
    context.state = ConversationState.ESCALATING;
    context.escalationReasons.push('Invalid conversation state');
    return;
  }

  logger.debug('State transition', {
    callId: context.callId,
    from: context.state,
    to: newState,
    reason,
  });

  context.state = newState;
}

/**
 * Map user input to intent
 */
export function determineIntent(userInput: string, aiIntent?: string): Intent {
  const normalized = userInput.toLowerCase().trim();

  // Check for emergency (highest priority)
  const emergencyCheck = checkEmergency(userInput);
  if (!emergencyCheck.safe) {
    return 'emergency';
  }

  // Check for clear confirmation
  const confirmPatterns = [
    'yes',
    'yeah',
    'yep',
    'sure',
    'okay',
    'ok',
    'confirmed',
    'i can make it',
    "i'll be there",
  ];
  if (confirmPatterns.some((p) => normalized.includes(p))) {
    return 'confirm';
  }

  // Check for reschedule
  const reschedulePatterns = ['reschedule', 'different time', 'another day', 'change', 'move'];
  if (reschedulePatterns.some((p) => normalized.includes(p))) {
    return 'reschedule';
  }

  // Check for cancellation
  const cancelPatterns = ['cancel', "don't want", 'not coming', "won't make it"];
  if (cancelPatterns.some((p) => normalized.includes(p))) {
    return 'cancel';
  }

  // Check for questions
  if (
    normalized.includes('?') ||
    normalized.startsWith('what') ||
    normalized.startsWith('when') ||
    normalized.startsWith('where') ||
    normalized.startsWith('how') ||
    normalized.startsWith('who')
  ) {
    return 'question';
  }

  // Use AI intent if provided and clear
  if (aiIntent && ['confirm', 'reschedule', 'cancel'].includes(aiIntent)) {
    return aiIntent as Intent;
  }

  return 'unclear';
}

/**
 * Add turn to transcript
 */
function addToTranscript(
  context: ConversationContext,
  role: 'user' | 'assistant',
  content: string,
): void {
  context.transcript.push({
    role,
    content,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Process user input and determine next state
 */
export function processUserInput(
  context: ConversationContext,
  userInput: string,
  aiAnalysis?: { intent: string; confidence: number; responseText: string },
): StateResponse {
  context.turnCount++;
  addToTranscript(context, 'user', userInput);

  // Check turn limit
  if (context.turnCount > context.maxTurns) {
    transitionTo(context, ConversationState.ESCALATING, 'Max turns exceeded');
    return {
      newState: ConversationState.ESCALATING,
      responseText:
        'I want to make sure we get this right. Let me have a staff member help you directly.',
      shouldHangup: true,
      requiresHuman: true,
      escalationReason: 'Conversation exceeded maximum turns',
    };
  }

  // Emergency check first (always)
  const safetyCheck = checkEmergency(userInput);
  if (!safetyCheck.safe) {
    transitionTo(context, ConversationState.EMERGENCY, safetyCheck.reason);
    return {
      newState: ConversationState.EMERGENCY,
      responseText:
        "I understand this is urgent. I'm connecting you to our staff right away. Please hold.",
      shouldHangup: true,
      requiresHuman: true,
      escalationReason: safetyCheck.reason,
    };
  }

  // Determine intent
  const intent = determineIntent(userInput, aiAnalysis?.intent);
  context.lastIntent = intent;
  context.intents.push(intent);

  // Process based on current state
  switch (context.state) {
    case ConversationState.GREETING:
    case ConversationState.LISTENING:
      return handleListeningState(context, intent, aiAnalysis);

    case ConversationState.CLARIFYING:
      return handleClarifyingState(context, intent, aiAnalysis);

    case ConversationState.CONFIRMING:
      return handleConfirmingState(context, intent, aiAnalysis);

    default:
      // Any unexpected state goes to escalation
      transitionTo(context, ConversationState.ESCALATING, 'Unexpected state');
      return {
        newState: ConversationState.ESCALATING,
        responseText: 'Let me have our staff help you with that.',
        shouldHangup: true,
        requiresHuman: true,
        escalationReason: 'Unexpected conversation state',
      };
  }
}

/**
 * Handle LISTENING state
 */
function handleListeningState(
  context: ConversationContext,
  intent: Intent,
  aiAnalysis?: { intent: string; confidence: number; responseText: string },
): StateResponse {
  switch (intent) {
    case 'confirm':
      transitionTo(context, ConversationState.COMPLETED, 'Patient confirmed');
      const confirmResponse =
        aiAnalysis?.responseText ||
        `Great, ${context.patientName}! I've confirmed your appointment. We look forward to seeing you.`;
      addToTranscript(context, 'assistant', confirmResponse);
      return {
        newState: ConversationState.COMPLETED,
        responseText: confirmResponse,
        shouldHangup: true,
        requiresHuman: false,
      };

    case 'reschedule':
      transitionTo(context, ConversationState.ESCALATING, 'Patient wants reschedule');
      const rescheduleResponse =
        "I understand you'd like to reschedule. I'll have our scheduling team call you back shortly to find a better time.";
      addToTranscript(context, 'assistant', rescheduleResponse);
      return {
        newState: ConversationState.ESCALATING,
        responseText: rescheduleResponse,
        shouldHangup: true,
        requiresHuman: true,
        escalationReason: 'Patient requested reschedule',
      };

    case 'cancel':
      transitionTo(context, ConversationState.ESCALATING, 'Patient wants cancellation');
      const cancelResponse =
        "I've noted your cancellation request. A staff member will follow up if needed.";
      addToTranscript(context, 'assistant', cancelResponse);
      return {
        newState: ConversationState.ESCALATING,
        responseText: cancelResponse,
        shouldHangup: true,
        requiresHuman: true,
        escalationReason: 'Patient requested cancellation',
      };

    case 'question':
      transitionTo(context, ConversationState.ESCALATING, 'Patient has question');
      const questionResponse =
        "That's a great question. Let me have our staff call you back with the answer.";
      addToTranscript(context, 'assistant', questionResponse);
      return {
        newState: ConversationState.ESCALATING,
        responseText: questionResponse,
        shouldHangup: true,
        requiresHuman: true,
        escalationReason: 'Patient has questions requiring human response',
      };

    case 'unclear':
    default:
      return handleUnclearIntent(context, aiAnalysis);
  }
}

/**
 * Handle CLARIFYING state
 */
function handleClarifyingState(
  context: ConversationContext,
  intent: Intent,
  aiAnalysis?: { intent: string; confidence: number; responseText: string },
): StateResponse {
  context.clarificationAttempts++;

  if (intent === 'unclear' && context.clarificationAttempts >= context.maxClarificationAttempts) {
    transitionTo(context, ConversationState.ESCALATING, 'Max clarification attempts');
    return {
      newState: ConversationState.ESCALATING,
      responseText:
        'I want to make sure I understand you correctly. Let me have a staff member call you back.',
      shouldHangup: true,
      requiresHuman: true,
      escalationReason: 'Unable to understand patient after multiple attempts',
    };
  }

  // Treat as fresh listening
  transitionTo(context, ConversationState.LISTENING, 'Retry after clarification');
  return handleListeningState(context, intent, aiAnalysis);
}

/**
 * Handle CONFIRMING state
 */
function handleConfirmingState(
  context: ConversationContext,
  intent: Intent,
  aiAnalysis?: { intent: string; confidence: number; responseText: string },
): StateResponse {
  // User might change mind or add info
  return handleListeningState(context, intent, aiAnalysis);
}

/**
 * Handle unclear intent
 */
function handleUnclearIntent(
  context: ConversationContext,
  aiAnalysis?: { intent: string; confidence: number; responseText: string },
): StateResponse {
  context.clarificationAttempts++;

  if (context.clarificationAttempts >= context.maxClarificationAttempts) {
    transitionTo(context, ConversationState.ESCALATING, 'Too many unclear responses');
    return {
      newState: ConversationState.ESCALATING,
      responseText: "I'm having trouble understanding. Let me have someone call you back.",
      shouldHangup: true,
      requiresHuman: true,
      escalationReason: 'Multiple unclear responses from patient',
    };
  }

  transitionTo(context, ConversationState.CLARIFYING, 'Need clarification');
  const clarifyResponse = context.appointmentDate
    ? `I want to make sure I heard you correctly. Are you able to make your appointment on ${context.appointmentDate}?`
    : "I didn't quite catch that. Could you please repeat?";
  addToTranscript(context, 'assistant', clarifyResponse);

  return {
    newState: ConversationState.CLARIFYING,
    responseText: clarifyResponse,
    shouldHangup: false,
    requiresHuman: false,
  };
}

/**
 * Get context summary for logging
 */
export function getContextSummary(context: ConversationContext): Record<string, any> {
  return {
    callId: context.callId,
    state: context.state,
    turnCount: context.turnCount,
    intents: context.intents,
    clarificationAttempts: context.clarificationAttempts,
    escalationReasons: context.escalationReasons,
  };
}
