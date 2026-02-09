/**
 * PHASE 2 TEST: Early Intent Engine
 * 
 * Measures pattern matching latency for simple intents
 * Target: <50ms for yes/no/cancel/confirm
 */

import { describe, test, expect } from 'vitest';
import { attemptEarlyExit } from '../lib/realtime-conversation';

describe('PHASE 2: Early Intent Engine - Latency', () => {
    test('Single word "yes" matches in <50ms', () => {
        const iterations = 100;
        const latencies: number[] = [];

        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            const result = attemptEarlyExit("yes");
            const elapsed = performance.now() - start;
            latencies.push(elapsed);

            expect(result).not.toBeNull();
            expect(result?.intent).toBe('confirm');
        }

        const avgLatency = latencies.reduce((a, b) => a + b, 0) / iterations;
        const maxLatency = Math.max(...latencies);

        console.log(`\n  ✅ Early exit "yes" performance:`);
        console.log(`     Average: ${avgLatency.toFixed(3)}ms`);
        console.log(`     Max:     ${maxLatency.toFixed(3)}ms`);
        console.log(`     Target:  <50ms`);

        expect(avgLatency).toBeLessThan(50);
        expect(maxLatency).toBeLessThan(50);
    });

    test('Denial "no" matches in <50ms', () => {
        const iterations = 100;
        const latencies: number[] = [];

        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            const result = attemptEarlyExit("no");
            const elapsed = performance.now() - start;
            latencies.push(elapsed);

            expect(result).not.toBeNull();
            expect(result?.intent).toBe('deny');
        }

        const avgLatency = latencies.reduce((a, b) => a + b, 0) / iterations;
        console.log(`\n  ✅ Early exit "no" performance:`);
        console.log(`     Average: ${avgLatency.toFixed(3)}ms`);

        expect(avgLatency).toBeLessThan(50);
    });

    test('Cancel phrase matches in <50ms', () => {
        const start = performance.now();
        const result = attemptEarlyExit("cancel my appointment");
        const elapsed = performance.now() - start;

        console.log(`\n  ✅ Early exit "cancel" latency: ${elapsed.toFixed(3)}ms`);

        expect(result?.intent).toBe('cancel');
        expect(elapsed).toBeLessThan(50);
    });

    test('Question detection in <50ms', () => {
        const start = performance.now();
        const result = attemptEarlyExit("what time is my appointment");
        const elapsed = performance.now() - start;

        console.log(`\n  ✅ Early exit "question" latency: ${elapsed.toFixed(3)}ms`);

        expect(result?.intent).toBe('question');
        expect(elapsed).toBeLessThan(50);
    });

    test('No false positives on complex sentences', () => {
        const complexPhrases = [
            "I'm not sure if I can make it because work keeps changing",
            "Well maybe I could try to reschedule but I need to check",
            "The thing is that my schedule is really complicated right now"
        ];

        complexPhrases.forEach(phrase => {
            const result = attemptEarlyExit(phrase);
            // Complex sentences should NOT early exit (need full AI)
            expect(result).toBeNull();
        });

        console.log(`\n  ✅ No false positives on ${complexPhrases.length} complex phrases`);
    });
});

describe('PHASE 2: Latency Improvement vs Gemini', () => {
    test('Early exit eliminates 3-5s Gemini wait', () => {
        const geminiLatency = 3500; // Average Gemini API call

        const start = performance.now();
        const result = attemptEarlyExit("yes");
        const earlyExitLatency = performance.now() - start;

        const improvement = geminiLatency - earlyExitLatency;
        const improvementPercent = (improvement / geminiLatency) * 100;

        console.log(`\n  📊 LATENCY ELIMINATION:`);
        console.log(`     Gemini (before):  ${geminiLatency}ms`);
        console.log(`     Early exit (now): ${earlyExitLatency.toFixed(2)}ms`);
        console.log(`     Improvement:      ${improvement.toFixed(2)}ms (${improvementPercent.toFixed(1)}%)`);

        expect(earlyExitLatency).toBeLessThan(geminiLatency);
        expect(improvementPercent).toBeGreaterThan(95); // >95% reduction
    });
});
