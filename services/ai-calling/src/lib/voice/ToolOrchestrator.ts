import { logger } from '../logging/structured-logger';
import { supabase } from '../supabase';
import { redisClient } from '../redis';
import { streamAnalyzeIntentWithTools, AnalysisResultWithTools } from '../gemini';
import { TOOL_DECLARATIONS } from '../../tools/definitions';
import { executeTool } from '../../tools/executor';
import { prepareForExternalAPI } from '../pii-redaction';
import { metrics } from '../metrics';

const MAX_TOOL_RECURSION = 3;
const MAX_TURNS_PER_CALL = 15;

export interface OrchestratorContext {
    callId?: string;
    clinicId?: string;
    patientId?: string;
    systemPrompt: string;
}

export interface OrchestratorCallbacks {
    onTextReady: (text: string) => Promise<void>;
    onToolExecution: (toolName: string) => Promise<void>;
    onFatalError: (action: 'hangup' | 'escalate', reason: string) => Promise<void>;
}

export class ToolOrchestrator {
    private context: OrchestratorContext;
    private callbacks: OrchestratorCallbacks;
    private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    private isInterrupted = false;

    constructor(context: OrchestratorContext, callbacks: OrchestratorCallbacks) {
        this.context = context;
        this.callbacks = callbacks;
    }

    public interrupt() {
        this.isInterrupted = true;
    }

    public resetInterrupt() {
        this.isInterrupted = false;
    }

    public async processWithAI(transcript: string, detectedLang: string = 'en', telemetryMark?: (event: string) => void): Promise<AnalysisResultWithTools | null> {
        try {
            this.resetInterrupt();

            this.conversationHistory.push({ role: 'user', content: transcript });
            if (telemetryMark) telemetryMark('gemini_start');

            // --- EMERGENCY LIABILITY HARD STOP ---
            const EMERGENCY_KEYWORDS = /\b(emergency|hospital|911|bleeding|severe pain|unconscious|breathing|heart attack)\b/i;
            if (EMERGENCY_KEYWORDS.test(transcript)) {
                logger.warn('MEDICAL EMERGENCY DETECTED in transcript', { transcript });

                if (this.context.callId) {
                    await supabase.from('ai_calls').update({
                        escalation_required: true,
                        escalation_reason: 'Automated Medical Emergency Hard Stop',
                        outcome: 'failed'
                    }).eq('id', this.context.callId);
                }

                await this.callbacks.onTextReady("If this is a medical emergency, please hang up and dial 911 immediately, or go to the nearest emergency room.");
                metrics.emergencyHardStops.inc({ clinic_id: this.context.clinicId || 'unknown' });
                await this.callbacks.onFatalError('hangup', 'Medical Emergency Fallback Triggered');
                return null;
            }

            // --- COST RUNAWAY CIRCUIT BREAKER (REDIS) ---
            if (this.context.callId) {
                const turnKey = `call_turns:${this.context.callId}`;
                const totalTurns = await redisClient.incr(turnKey);
                if (totalTurns === 1) await redisClient.expire(turnKey, 3600); // 1 hour TTL

                if (totalTurns > MAX_TURNS_PER_CALL) {
                    logger.error(`COST RUNAWAY PREVENTED: Call ${this.context.callId} exceeded ${MAX_TURNS_PER_CALL} turns. Hard disconnect.`, { transcript });

                    await supabase.from('ai_calls').update({
                        escalation_required: true,
                        escalation_reason: 'Cost runaway circuit breaker tripped (>15 turns)',
                        outcome: 'failed'
                    }).eq('id', this.context.callId);

                    await this.callbacks.onFatalError('hangup', 'Circuit breaker tripped');
                    return null;
                }
            }

            const redactedTranscript = prepareForExternalAPI(transcript, 'gemini');
            const augmentedTranscript = detectedLang !== 'en' ? `[User spoke in ${detectedLang}] ${transcript}` : transcript;

            const finalAnalysis = await this.runToolLoop(augmentedTranscript);

            if (telemetryMark) telemetryMark('gemini_complete');

            if (this.context.callId) {
                await supabase
                    .from('ai_calls')
                    .update({
                        transcript: {
                            user: transcript,
                            ai: finalAnalysis.response_text,
                            intent: finalAnalysis.intent,
                            tool_used: finalAnalysis.tool_used || null,
                        },
                        confidence_score: finalAnalysis.confidence,
                        escalation_required: finalAnalysis.requires_human,
                    })
                    .eq('id', this.context.callId);
            }

            return finalAnalysis;

        } catch (error) {
            logger.error('ToolOrchestrator processing failed', { error });
            await this.callbacks.onFatalError('escalate', 'Processing failed');
            return null;
        }
    }

    private async runToolLoop(transcript: string, depth = 0): Promise<AnalysisResultWithTools> {
        if (depth > MAX_TOOL_RECURSION) {
            logger.warn('Max tool recursion depth reached', { transcript });
            const fallback: AnalysisResultWithTools = {
                intent: 'unknown',
                response_text: "I'm having a bit of trouble processing that request. Could we try again?",
                confidence: 0,
                requires_human: true,
            };
            await this.callbacks.onTextReady(fallback.response_text);
            return fallback;
        }

        const stream = streamAnalyzeIntentWithTools(
            this.context.systemPrompt,
            transcript,
            this.conversationHistory,
            TOOL_DECLARATIONS,
        );

        let finalResult: AnalysisResultWithTools | null = null;
        let textBuffer = '';
        // Faster TTFB chunking (yield on commas and semicolons as well as full stops)
        const sentenceEndRegex = /([.?!,;:]+)\s+/;

        try {
            for await (const event of stream) {
                if (this.isInterrupted) {
                    logger.info('Barge-in detected (VAD): Truncating AI generation natively.');
                    metrics.bargeInTruncations.inc({ clinic_id: this.context.clinicId || 'unknown' });
                    break;
                }

                if (event.type === 'text_delta') {
                    textBuffer += event.content;
                    let match;
                    while ((match = textBuffer.match(sentenceEndRegex)) !== null) {
                        const endIndex = match.index! + match[1].length;
                        const sentence = textBuffer.substring(0, endIndex).trim();
                        textBuffer = textBuffer.substring(endIndex);

                        if (sentence) {
                            await this.callbacks.onTextReady(sentence);
                        }
                    }
                } else if (event.type === 'complete') {
                    finalResult = event.result;
                }
            }
        } catch (error) {
            logger.error('Error in orchestrator analysis loop', { error: (error as Error).message });
            await this.callbacks.onTextReady("I'm sorry, I'm having connection issues. Can you say that again?");
            return { intent: 'unknown', response_text: '', confidence: 0, requires_human: true };
        }

        if (textBuffer.trim() && !this.isInterrupted) {
            await this.callbacks.onTextReady(textBuffer.trim());
        }

        if (!finalResult) {
            if (this.isInterrupted) {
                // Record explicit barge-in truncation
                this.conversationHistory.push({
                    role: 'assistant',
                    content: '[User Interrupted - Response Truncated by VAD]'
                });
                return { intent: 'unknown', response_text: '', confidence: 0, requires_human: false };
            }
            return { intent: 'unknown', response_text: '', confidence: 0, requires_human: true };
        }

        this.conversationHistory.push({
            role: 'assistant',
            content: this.isInterrupted ? `[Truncated] ${finalResult.response_text}` : finalResult.response_text,
        });

        if (finalResult.tool_call && !this.isInterrupted) {
            const toolName = finalResult.tool_call.name;
            const toolArgs = finalResult.tool_call.arguments;

            logger.info('Executing tool from orchestrator', { tool: toolName, args: toolArgs });

            await this.callbacks.onToolExecution(toolName);

            try {
                const argsCopy = { ...toolArgs } as Record<string, unknown>;

                if (!argsCopy.clinicId) argsCopy.clinicId = this.context.clinicId;
                if (!argsCopy.patientId) argsCopy.patientId = this.context.patientId;
                if (!argsCopy.callId) argsCopy.callId = this.context.callId;

                const toolResult = await executeTool({
                    name: toolName as any,
                    arguments: argsCopy as any,
                });

                const toolOutputTranscript = `[SYSTEM: Tool '${toolName}' Result]: ${JSON.stringify(toolResult)}`;

                this.conversationHistory.push({
                    role: 'user',
                    content: toolOutputTranscript,
                });

                return await this.runToolLoop('Please continue based on the tool result.', depth + 1);
            } catch (toolError) {
                logger.error('Tool execution failed inside orchestrator', { tool: toolName, error: toolError });
                await this.callbacks.onTextReady("I'm having trouble accessing that information right now.");
                return finalResult;
            }
        }

        return finalResult;
    }
}
