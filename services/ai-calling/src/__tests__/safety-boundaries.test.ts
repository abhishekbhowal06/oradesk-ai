/**
 * Safety Boundaries Unit Tests
 * 
 * Tests for emergency detection, prohibited topics, and safety boundaries.
 */

import { describe, it, expect } from 'vitest';
import {
    checkEmergency,
    checkProhibitedTopics,
    sanitizeAIResponse,
    getHardenedSystemPrompt,
    AI_DISCLOSURE_SCRIPT
} from '../lib/safety-boundaries';

describe('Safety Boundaries', () => {
    describe('checkEmergency', () => {
        it('should detect critical emergency phrases', () => {
            const criticalPhrases = [
                'I am having a heart attack',
                'I think I\'m dying',
                'I can\'t breathe',
                'someone call 911'
            ];

            criticalPhrases.forEach(phrase => {
                const result = checkEmergency(phrase);
                expect(result.safe).toBe(false);
                expect(result.escalationType).toBe('emergency');
            });
        });

        it('should detect medical emergency phrases', () => {
            const emergencyPhrases = [
                'I have severe pain',
                'there is bleeding from my mouth',
                'I had an accident',
                'my face is swelling'
            ];

            emergencyPhrases.forEach(phrase => {
                const result = checkEmergency(phrase);
                expect(result.safe).toBe(false);
                expect(result.escalationType).toBe('emergency');
            });
        });

        it('should detect human handoff requests', () => {
            const handoffPhrases = [
                'speak to someone now',
                'talk to someone now',
                'transfer me now',
                'operator now'
            ];

            handoffPhrases.forEach(phrase => {
                const result = checkEmergency(phrase);
                expect(result.safe).toBe(false);
                expect(result.escalationType).toBe('human_request');
            });
        });

        it('should mark safe phrases as safe', () => {
            const safePhrases = [
                'yes I can make it',
                'I need to reschedule',
                'what time is my appointment',
                'sounds good thank you'
            ];

            safePhrases.forEach(phrase => {
                const result = checkEmergency(phrase);
                expect(result.safe).toBe(true);
            });
        });

        it('should be case insensitive', () => {
            const result1 = checkEmergency('I AM BLEEDING');
            const result2 = checkEmergency('i am bleeding');

            expect(result1.safe).toBe(false);
            expect(result2.safe).toBe(false);
        });
    });

    describe('checkProhibitedTopics', () => {
        it('should detect medical diagnosis requests', () => {
            const diagnosisPhrases = [
                'do you think I have cancer',
                'what disease do I have',
                'can you diagnose this'
            ];

            diagnosisPhrases.forEach(phrase => {
                const result = checkProhibitedTopics(phrase);
                expect(result.safe).toBe(false);
            });
        });

        it('should detect medication/drug questions', () => {
            const medPhrases = [
                'what medication should I take',
                'should I take ibuprofen',  // Contains 'should i take' and 'ibuprofen'
                'can you prescribe something'  // Contains 'prescription' root
            ];

            medPhrases.forEach(phrase => {
                const result = checkProhibitedTopics(phrase);
                expect(result.safe).toBe(false);
            });
        });

        it('should detect treatment cost questions', () => {
            const costPhrases = [
                'how much will it cost',
                'costs $500',
                'out of pocket cost'
            ];

            costPhrases.forEach(phrase => {
                const result = checkProhibitedTopics(phrase);
                expect(result.safe).toBe(false);
            });
        });

        it('should allow scheduling-related questions', () => {
            const allowedPhrases = [
                'when is my next appointment',
                'can I reschedule to Tuesday',
                'what time is the office open',
                'how do I cancel my appointment'
            ];

            allowedPhrases.forEach(phrase => {
                const result = checkProhibitedTopics(phrase);
                expect(result.safe).toBe(true);
            });
        });
    });

    describe('sanitizeAIResponse', () => {
        it('should remove dosage recommendations', () => {
            const response = 'Take 500mg of ibuprofen twice daily';
            const sanitized = sanitizeAIResponse(response);
            expect(sanitized).not.toContain('500mg');
            expect(sanitized).not.toContain('twice daily');
        });

        it('should remove diagnosis language', () => {
            const response = 'It sounds like you have gingivitis';
            const sanitized = sanitizeAIResponse(response);
            expect(sanitized).toContain('staff member');
        });

        it('should leave safe responses unchanged', () => {
            const response = 'Great! Your appointment is confirmed for tomorrow at 2 PM.';
            const sanitized = sanitizeAIResponse(response);
            expect(sanitized).toBe(response);
        });

        it('should remove pricing information', () => {
            const response = 'That procedure costs $500';
            const sanitized = sanitizeAIResponse(response);
            expect(sanitized).not.toContain('$500');
        });
    });

    describe('AI Disclosure Script', () => {
        it('should contain disclosure that this is automated', () => {
            expect(AI_DISCLOSURE_SCRIPT.toLowerCase()).toContain('automated');
        });

        it('should mention AI assistant', () => {
            expect(AI_DISCLOSURE_SCRIPT.toLowerCase()).toContain('ai');
        });

        it('should offer human alternative', () => {
            const hasHuman = AI_DISCLOSURE_SCRIPT.toLowerCase().includes('human') ||
                AI_DISCLOSURE_SCRIPT.toLowerCase().includes('staff') ||
                AI_DISCLOSURE_SCRIPT.toLowerCase().includes('person');
            expect(hasHuman).toBe(true);
        });
    });

    describe('getHardenedSystemPrompt', () => {
        it('should contain prohibition against medical advice', () => {
            const prompt = getHardenedSystemPrompt('confirmation');
            expect(prompt.toLowerCase()).toContain('cannot');
            expect(prompt.toLowerCase()).toContain('medical');
        });

        it('should contain prohibition against diagnosis', () => {
            const prompt = getHardenedSystemPrompt('confirmation');
            expect(prompt.toLowerCase()).toContain('diagnos');
        });

        it('should specify assistant name', () => {
            const prompt = getHardenedSystemPrompt('confirmation');
            expect(prompt.toLowerCase()).toContain('sarah');
        });

        it('should contain response format instructions', () => {
            const prompt = getHardenedSystemPrompt('confirmation');
            expect(prompt.toLowerCase()).toContain('json');
        });
    });
});
