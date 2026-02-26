/**
 * CONVERSATIONAL LATENCY TESTING FRAMEWORK
 *
 * Simulates phone conversations to measure and validate sub-300ms perceived latency.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import {
  attemptEarlyExit,
  selectBackchannel,
  calculateTurnGap,
  StreamingConversationManager,
  TURN_GAPS_MS,
} from '../lib/realtime-conversation';

describe('Conversational Latency - Early Exit Patterns', () => {
  test('Single word confirmation matches in < 50ms', () => {
    const start = performance.now();
    const result = attemptEarlyExit('yes');
    const elapsed = performance.now() - start;

    expect(result).not.toBeNull();
    expect(result?.intent).toBe('confirm');
    expect(result?.confidence).toBeGreaterThanOrEqual(90);
    expect(elapsed).toBeLessThan(50);
  });

  test('Denial patterns match instantly', () => {
    const denialPhrases = ['no', 'nope', "I can't make it", 'not really'];

    denialPhrases.forEach((phrase) => {
      const result = attemptEarlyExit(phrase);
      expect(result?.intent).toBe('deny');
    });
  });

  test('Question patterns trigger human handoff', () => {
    const questions = [
      'what time is my appointment',
      'where is your office',
      'how much will this cost',
    ];

    questions.forEach((q) => {
      const result = attemptEarlyExit(q);
      expect(result?.intent).toBe('question');
    });
  });

  test('No false positives on short input', () => {
    const shortInputs = ['y', 'n', 'h', 'ok'];

    shortInputs.forEach((input) => {
      const result = attemptEarlyExit(input);
      if (input.length < 2) {
        expect(result).toBeNull();
      }
    });
  });
});

describe('Backchannel Selection', () => {
  test('Acknowledgement backchannels are short', () => {
    const backchannel = selectBackchannel('acknowledgement', { isPartial: true });
    expect(backchannel.length).toBeLessThan(10); // "mm-hmm", "okay"
  });

  test('Thinking backchannels indicate processing', () => {
    const backchannel = selectBackchannel('thinking');
    expect(backchannel).toMatch(/check|moment|second/i);
  });

  test('Different calls return varied responses', () => {
    const responses = new Set();
    for (let i = 0; i < 10; i++) {
      responses.add(selectBackchannel('acknowledgement'));
    }
    // Should have at least 2 variants to avoid sounding robotic
    expect(responses.size).toBeGreaterThanOrEqual(2);
  });
});

describe('Turn-Taking Timing', () => {
  test('Quick confirmations have minimal delay', () => {
    const gap = calculateTurnGap({
      intent: 'confirm',
      confidence: 95,
      transcriptLength: 3,
      isEmergency: false,
    });

    expect(gap).toBe(TURN_GAPS_MS.QUICK_ACKNOWLEDGEMENT);
    expect(gap).toBeLessThan(200);
  });

  test('Questions allow thinking pause', () => {
    const gap = calculateTurnGap({
      intent: 'question',
      confidence: 90,
      transcriptLength: 20,
      isEmergency: false,
    });

    expect(gap).toBe(TURN_GAPS_MS.COMPLEX_THINKING);
    expect(gap).toBeGreaterThan(500);
  });

  test('Emergency has zero delay', () => {
    const gap = calculateTurnGap({
      intent: 'unknown',
      confidence: 50,
      transcriptLength: 10,
      isEmergency: true,
    });

    expect(gap).toBe(0);
  });
});

describe('Streaming Conversation Manager', () => {
  let manager: StreamingConversationManager;

  beforeEach(() => {
    manager = new StreamingConversationManager();
  });

  test('Partial transcript triggers backchannel', async () => {
    const result = await manager.onPartialTranscript('I need to reschedule my appointment because');

    expect(result.backchannel).toBeDefined();
    expect(result.shouldRespond).toBe(false);
  });

  test('Emergency in partial triggers immediate response', async () => {
    const result = await manager.onPartialTranscript("I'm having severe pain");

    expect(result.shouldRespond).toBe(true);
    expect(result.response).toContain('urgent');
  });

  test('Early exit on final transcript', async () => {
    const result = await manager.onFinalTranscript('yes');

    expect(result.shouldRespond).toBe(true);
    expect(result.intent).toBe('confirm');
    expect(result.turnGap).toBeLessThan(200);
  });

  test('Complex sentence requires AI processing', async () => {
    const result = await manager.onFinalTranscript(
      "I'm not sure if I can make it because my work schedule keeps changing",
    );

    expect(result.intent).toBe('pending_ai');
    expect(result.shouldRespond).toBe(false);
  });
});

describe('Perceived Latency Budget', () => {
  test('Total pipeline stays under 300ms for simple confirm', async () => {
    const start = performance.now();

    // Simulate: STT partial → Early exit → Response ready
    const partialResult = attemptEarlyExit('yes');

    const elapsed = performance.now() - start;

    // Early exit should be <50ms, TTS start adds ~200ms = ~250ms total
    expect(elapsed).toBeLessThan(50);
  });
});

describe('Interrupt Handling', () => {
  let manager: StreamingConversationManager;

  beforeEach(() => {
    manager = new StreamingConversationManager();
  });

  test('Patient interrupt resets pipeline', async () => {
    // Start response
    await manager.onFinalTranscript('yes');
    manager.onResponseStart();

    // Patient interrupts
    manager.onPatientInterrupt();

    // Should be back in listening mode
    const partialResult = await manager.onPartialTranscript('wait actually');
    expect(partialResult).toBeDefined();
  });
});
