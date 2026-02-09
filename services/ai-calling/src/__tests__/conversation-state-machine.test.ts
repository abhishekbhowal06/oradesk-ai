/**
 * Conversation State Machine Unit Tests
 * 
 * Tests for deterministic conversation state transitions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    createConversationContext,
    processUserInput,
    ConversationState,
    determineIntent,
    getContextSummary
} from '../lib/conversation-state-machine';

describe('Conversation State Machine', () => {
    let context: ReturnType<typeof createConversationContext>;

    beforeEach(() => {
        context = createConversationContext(
            'test-call-123',
            'John',
            'apt-456',
            'February 10th at 2 PM',
            'Cleaning'
        );
    });

    describe('createConversationContext', () => {
        it('should create context with initial state', () => {
            expect(context.state).toBe(ConversationState.GREETING);
            expect(context.turnCount).toBe(0);
            expect(context.patientName).toBe('John');
        });

        it('should initialize empty transcript', () => {
            expect(context.transcript).toEqual([]);
        });
    });

    describe('determineIntent', () => {
        it('should detect confirmation intents', () => {
            const confirmPhrases = ['yes', 'yeah okay', 'sure I can make it', 'yep'];
            confirmPhrases.forEach(phrase => {
                expect(determineIntent(phrase)).toBe('confirm');
            });
        });

        it('should detect reschedule intents', () => {
            const reschedulePhrases = ['I want to reschedule', 'can we do another day', 'can you change my appointment'];
            reschedulePhrases.forEach(phrase => {
                expect(determineIntent(phrase)).toBe('reschedule');
            });
        });

        it('should detect cancel intents', () => {
            const cancelPhrases = ['I want to cancel', "I'm not coming", "cancel my appointment"];
            cancelPhrases.forEach(phrase => {
                expect(determineIntent(phrase)).toBe('cancel');
            });
        });

        it('should detect questions', () => {
            const questionPhrases = ['what is the address?', 'where is the office?', 'how long is the visit?'];
            questionPhrases.forEach(phrase => {
                expect(determineIntent(phrase)).toBe('question');
            });
        });

        it('should detect emergency intents', () => {
            const emergencyPhrases = ['I am bleeding', 'I have severe pain', 'my face is swelling'];
            emergencyPhrases.forEach(phrase => {
                expect(determineIntent(phrase)).toBe('emergency');
            });
        });

        it('should return unclear for ambiguous input', () => {
            expect(determineIntent('hmm')).toBe('unclear');
            expect(determineIntent('well...')).toBe('unclear');
        });
    });

    describe('processUserInput', () => {
        describe('confirmation flow', () => {
            it('should transition to COMPLETED on confirmation', () => {
                context.state = ConversationState.LISTENING;
                const result = processUserInput(context, 'yes I can make it');

                expect(result.newState).toBe(ConversationState.COMPLETED);
                expect(result.shouldHangup).toBe(true);
                expect(result.requiresHuman).toBe(false);
            });

            it('should include confirmation in response', () => {
                context.state = ConversationState.LISTENING;
                const result = processUserInput(context, 'yes');

                expect(result.responseText.toLowerCase()).toContain('confirm');
            });
        });

        describe('reschedule flow', () => {
            it('should transition to ESCALATING on reschedule', () => {
                context.state = ConversationState.LISTENING;
                const result = processUserInput(context, 'I need to reschedule');

                expect(result.newState).toBe(ConversationState.ESCALATING);
                expect(result.requiresHuman).toBe(true);
                expect(result.escalationReason).toContain('reschedule');
            });
        });

        describe('cancellation flow', () => {
            it('should transition to ESCALATING on cancel', () => {
                context.state = ConversationState.LISTENING;
                const result = processUserInput(context, 'cancel my appointment');

                expect(result.newState).toBe(ConversationState.ESCALATING);
                expect(result.requiresHuman).toBe(true);
                expect(result.escalationReason).toContain('cancel');
            });
        });

        describe('emergency handling', () => {
            it('should immediately escalate on emergency', () => {
                context.state = ConversationState.LISTENING;
                const result = processUserInput(context, 'I am having severe pain');

                expect(result.newState).toBe(ConversationState.EMERGENCY);
                expect(result.requiresHuman).toBe(true);
                expect(result.shouldHangup).toBe(true);
            });

            it('should detect emergency from any state', () => {
                const states = [
                    ConversationState.GREETING,
                    ConversationState.LISTENING,
                    ConversationState.CLARIFYING
                ];

                states.forEach(state => {
                    const ctx = createConversationContext('test', 'John');
                    ctx.state = state;
                    const result = processUserInput(ctx, 'I am bleeding');
                    expect(result.newState).toBe(ConversationState.EMERGENCY);
                });
            });
        });

        describe('clarification flow', () => {
            it('should ask for clarification on unclear input', () => {
                context.state = ConversationState.LISTENING;
                const result = processUserInput(context, 'hmm maybe');

                expect(result.newState).toBe(ConversationState.CLARIFYING);
                expect(result.shouldHangup).toBe(false);
            });

            it('should escalate after max clarification attempts', () => {
                context.state = ConversationState.CLARIFYING;
                context.clarificationAttempts = 2;

                const result = processUserInput(context, 'still unclear');

                expect(result.newState).toBe(ConversationState.ESCALATING);
                expect(result.requiresHuman).toBe(true);
            });
        });

        describe('turn limits', () => {
            it('should escalate when turn limit exceeded', () => {
                context.state = ConversationState.LISTENING;
                context.turnCount = 11;
                context.maxTurns = 10;

                const result = processUserInput(context, 'yes');

                expect(result.newState).toBe(ConversationState.ESCALATING);
                expect(result.escalationReason).toContain('turn');
            });
        });

        describe('transcript tracking', () => {
            it('should add user input to transcript', () => {
                context.state = ConversationState.LISTENING;
                processUserInput(context, 'test message');

                expect(context.transcript.length).toBeGreaterThan(0);
                expect(context.transcript[0].role).toBe('user');
                expect(context.transcript[0].content).toBe('test message');
            });

            it('should add assistant response to transcript', () => {
                context.state = ConversationState.LISTENING;
                processUserInput(context, 'yes');

                const assistantMessages = context.transcript.filter(t => t.role === 'assistant');
                expect(assistantMessages.length).toBeGreaterThan(0);
            });
        });
    });

    describe('getContextSummary', () => {
        it('should return summary with key fields', () => {
            context.state = ConversationState.LISTENING;
            context.turnCount = 5;
            context.intents = ['confirm', 'unclear'];

            const summary = getContextSummary(context);

            expect(summary.callId).toBe('test-call-123');
            expect(summary.state).toBe(ConversationState.LISTENING);
            expect(summary.turnCount).toBe(5);
            expect(summary.intents).toEqual(['confirm', 'unclear']);
        });
    });
});
