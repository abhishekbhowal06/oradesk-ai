/**
 * GEMINI INTELLIGENCE MODULE v2 — "OPERATION SYNAPSE"
 *
 * Handles all Gemini API interactions for the dental AI receptionist.
 * Now supports:
 * - Function-calling with tool declarations
 * - Conversation history for statefulness
 * - Custom system prompts (Sarah receptionist brain)
 * - Safety checks and sanitization
 * - Streaming responses for ultra-low latency (Phase 3 Fix)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { logger } from './logging/structured-logger';
import {
  getHardenedSystemPrompt,
  sanitizeAIResponse,
  checkProhibitedTopics,
} from './safety-boundaries';

dotenv.config();

import { geminiRoundRobin } from './gemini-rotation';

function getModel() {
  const key = geminiRoundRobin.getNextKey();
  if (!key) throw new Error('No valid Gemini API keys found in rotation pool');
  const genAI = new GoogleGenerativeAI(key);
  return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
}


// ── Types ───────────────────────────────────────────────────

export interface AnalysisResult {
  intent:
  | 'confirm'
  | 'reschedule'
  | 'cancel'
  | 'book_appointment'
  | 'question'
  | 'not_interested'
  | 'unknown';
  response_text: string;
  confidence: number;
  requires_human: boolean;
}

export interface AnalysisResultWithTools extends AnalysisResult {
  tool_call?: {
    name: string;
    arguments: Record<string, unknown>;
  } | null;
  tool_used?: string;
  detected_objection?: string | null;
  sentiment?: string;
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── Legacy: analyzeIntent (backward-compatible) ─────────────

/**
 * Analyze patient intent with safety-hardened prompt.
 * Returns sanitized response with requires_human flag.
 *
 * LEGACY — kept for backward compatibility with existing callers.
 * New code should use analyzeIntentWithTools instead.
 */
export async function analyzeIntent(
  callContext: string,
  userTranscript: string,
  callType: string = 'confirmation',
): Promise<AnalysisResult> {
  const systemPrompt = getHardenedSystemPrompt(callType);

  const userPrompt = `
APPOINTMENT CONTEXT:
${callContext}

PATIENT SAID: "${userTranscript}"

Analyze and respond with JSON only.`;

  try {
    const result = await getModel().generateContent(systemPrompt + '\n\n' + userPrompt);
    const response = await result.response;
    const text = response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Gemini response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const rawResponseText = parsed.response_text || 'Let me connect you with our team.';
    const intent = parsed.intent || 'unknown';
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
    let requiresHuman = parsed.requires_human === true;

    const safetyCheck = checkProhibitedTopics(rawResponseText);
    if (!safetyCheck.safe) {
      logger.warn('AI response contained prohibited topic, sanitizing', {
        original: rawResponseText,
        detectedPhrase: safetyCheck.detectedPhrase,
      });
      requiresHuman = true;
    }

    const sanitizedResponse = sanitizeAIResponse(rawResponseText);

    if (confidence < 50) requiresHuman = true;
    if (intent === 'question') requiresHuman = true;

    return { intent, response_text: sanitizedResponse, confidence, requires_human: requiresHuman };
  } catch (error) {
    logger.error('Gemini analysis failed', { error: (error as Error).message });

    return {
      intent: 'unknown',
      response_text: 'I apologize, let me connect you with our team who can better assist you.',
      confidence: 0,
      requires_human: true,
    };
  }
}

// ── New: analyzeIntentWithTools (function-calling) ──────────

/**
 * Analyze patient intent with full Sarah prompt, conversation history,
 * and function-calling tool declarations.
 *
 * Returns an AnalysisResultWithTools that may include a tool_call
 * if the AI decides to invoke checkAvailability, bookAppointment, etc.
 */
export async function analyzeIntentWithTools(
  systemPrompt: string,
  userTranscript: string,
  conversationHistory: ConversationMessage[],
  toolDeclarations: ReadonlyArray<Record<string, unknown>>,
  _callType: string = 'confirmation',
): Promise<AnalysisResultWithTools> {
  // Build conversation context from history
  const historyContext =
    conversationHistory.length > 0
      ? '\n\nCONVERSATION SO FAR:\n' +
      conversationHistory
        .map((msg) => `${msg.role === 'user' ? 'PATIENT' : 'SARAH'}: ${msg.content}`)
        .join('\n')
      : '';

  // Build tools context for the prompt
  const toolsContext =
    toolDeclarations.length > 0
      ? '\n\nAVAILABLE TOOLS (use tool_call in your JSON to invoke):\n' +
      toolDeclarations.map((t) => `- ${t.name}: ${t.description}`).join('\n')
      : '';

  const fullPrompt = `${systemPrompt}${historyContext}${toolsContext}

CURRENT PATIENT INPUT: "${userTranscript}"

Respond with a JSON object. Include a "tool_call" field if you need to use a tool.
JSON format:
{
    "intent": "<intent>",
    "response_text": "<what you say to the patient>",
    "confidence": <0-100>,
    "requires_human": <true|false>,
    "tool_call": null | { "name": "<tool_name>", "arguments": { ... } },
    "detected_objection": null | "<objection_type>",
    "sentiment": "<positive|neutral|hesitant|frustrated|angry>"
}`;

  try {
    const { chaosMonkey } = require('../lib/chaos-monkey');
    await chaosMonkey.handleChaos('gemini');

    const { geminiCircuitBreaker } = require('./circuit-breaker');
    const result = await geminiCircuitBreaker.execute(() => getModel().generateContent(fullPrompt));
    const response = await result.response;
    const text = response.text();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Fallback for simple text response
      logger.warn('No JSON found in Gemini response, treating as text');
      return {
        intent: 'unknown',
        response_text: text,
        confidence: 50,
        requires_human: false,
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return processParsedResponse(parsed);
  } catch (error) {
    logger.error('Gemini analysis with tools failed', {
      error: (error as Error).message,
    });

    return {
      intent: 'unknown',
      response_text: 'I apologize, let me connect you with our team who can better assist you.',
      confidence: 0,
      requires_human: true,
      tool_call: null,
    };
  }
}

// ── Streaming Support (Phase 3) ────────────────────────────

export type StreamEvent =
  | { type: 'text_delta'; content: string }
  | { type: 'complete'; result: AnalysisResultWithTools };

/**
 * Stream the analysis result.
 * Optimizes latency by using a special prompt format to output text FIRST,
 * then JSON metadata.
 */
export async function* streamAnalyzeIntentWithTools(
  systemPrompt: string,
  userTranscript: string,
  conversationHistory: ConversationMessage[],
  toolDeclarations: ReadonlyArray<Record<string, unknown>>,
): AsyncGenerator<StreamEvent> {
  // Build context
  const historyContext = conversationHistory
    .map((msg) => `${msg.role === 'user' ? 'PATIENT' : 'SARAH'}: ${msg.content}`)
    .join('\n');

  const toolsContext = toolDeclarations.map((t) => `- ${t.name}: ${t.description}`).join('\n');

  // SPECIAL STREAMING PROMPT
  // Forces "Text: ..." first to allow immediate TTS
  const fullPrompt = `${systemPrompt}

CONVERSATION HISTORY:
${historyContext}

AVAILABLE TOOLS:
${toolsContext}

CURRENT PATIENT INPUT: "${userTranscript}"

INSTRUCTIONS:
1. First, output the text response to the patient, prefixed with "Text: ".
2. Then, output the JSON metadata (intent, tools, etc), prefixed with "JSON: ".
3. Do not include markdown code blocks.

Example Output:
Text: Hello, how can I help you today?
JSON: { "intent": "greeting", "confidence": 100, "tool_call": null }
`;

  try {
    const { geminiCircuitBreaker } = require('./circuit-breaker');
    const result = await geminiCircuitBreaker.execute(() => getModel().generateContentStream(fullPrompt));

    let buffer = '';
    let mode: 'text' | 'json' | 'unknown' = 'unknown';
    let jsonBuffer = '';

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      buffer += chunkText;

      // Detect Mode Switching
      if (mode === 'unknown') {
        if (buffer.startsWith('Text: ')) {
          mode = 'text';
          buffer = buffer.substring(6); // Strip prefix
        } else if (buffer.startsWith('JSON: ')) {
          mode = 'json';
          buffer = buffer.substring(6);
        } else if (buffer.length > 20) {
          // Fallback if model ignores instructions
          mode = 'text';
        }
      }

      if (mode === 'text') {
        const jsonIndex = buffer.indexOf('JSON:');
        if (jsonIndex !== -1) {
          // Switch to JSON
          const textPart = buffer.substring(0, jsonIndex);
          if (textPart.trim()) {
            yield { type: 'text_delta', content: textPart };
          }

          mode = 'json';
          jsonBuffer = buffer.substring(jsonIndex + 5); // Start JSON buffer
          buffer = ''; // Clear buffer
        } else {
          // Still in text mode
          yield { type: 'text_delta', content: buffer };
          buffer = ''; // Clear emitted buffer
        }
      } else if (mode === 'json') {
        jsonBuffer += buffer;
        buffer = '';
      }
    }

    // Processing complete - Parse JSON
    let parsed: any = {};
    try {
      // Find JSON in the buffer
      const jsonMatch = jsonBuffer.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        // Should not happen if prompt is followed
        logger.warn('No JSON found in streaming response end', { jsonBuffer });
      }
    } catch (e) {
      logger.error('Failed to parse final JSON from stream', e);
    }

    // Return completeness
    const analysisResult = processParsedResponse(parsed);
    yield { type: 'complete', result: analysisResult };
  } catch (error) {
    logger.error('Stream generation failed', error);
    yield {
      type: 'complete',
      result: {
        intent: 'unknown',
        response_text: "I'm having trouble connecting. One moment.",
        confidence: 0,
        requires_human: true,
      },
    };
  }
}

/**
 * Helper to process the raw JSON into our Type
 */
function processParsedResponse(parsed: any): AnalysisResultWithTools {
  const rawResponseText = parsed.response_text || '';
  const intent = parsed.intent || 'unknown';
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
  let requiresHuman = parsed.requires_human === true;

  // Safety checks
  if (rawResponseText) {
    const safetyCheck = checkProhibitedTopics(rawResponseText);
    if (!safetyCheck.safe) {
      requiresHuman = true;
    }
  }

  const sanitizedResponse = sanitizeAIResponse(rawResponseText);

  if (confidence < 50) requiresHuman = true;

  const toolCall =
    parsed.tool_call && parsed.tool_call.name
      ? {
        name: String(parsed.tool_call.name),
        arguments: (parsed.tool_call.arguments || {}) as Record<string, unknown>,
      }
      : null;

  return {
    intent,
    response_text: sanitizedResponse,
    confidence,
    requires_human: requiresHuman,
    tool_call: toolCall,
    tool_used: toolCall?.name || undefined,
    detected_objection: parsed.detected_objection || null,
    sentiment: parsed.sentiment || 'neutral',
  };
}
