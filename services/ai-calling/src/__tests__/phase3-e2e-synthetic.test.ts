/**
 * PHASE 3 TEST: Synthetic End-to-End Orchestrator Pipeline
 * 
 * Verifies that the V2 pipeline (ToolOrchestrator) correctly identifies
 * a user intent, triggers a tool call, and executes the fallback/circuit breaker
 * logic without hanging or throwing unhandled errors in a Node environment.
 */

import { describe, test, expect, beforeAll, vi } from 'vitest';
import { ToolOrchestrator } from '../lib/voice/ToolOrchestrator';

describe('PHASE 3: Synthetic E2E ToolOrchestrator Pipeline', () => {

    const mockCallbacks = {
        onTextReady: vi.fn().mockResolvedValue(undefined),
        onToolExecution: vi.fn().mockResolvedValue(undefined),
        onFatalError: vi.fn().mockResolvedValue(undefined),
    };

    const mockTelemetry = vi.fn();

    beforeAll(() => {
        // Clear mocks before tests
        vi.clearAllMocks();

        // Ensure V1 is bypassed and tool recursion is realistic
        process.env.USE_V2_PIPELINE = 'true';
    });

    test('Orchestrator responds to standard conversational prompt', async () => {
        const orchestrator = new ToolOrchestrator({
            callId: 'test-call-123',
            clinicId: 'clinic-456',
            patientId: 'patient-789',
            systemPrompt: 'You are a helpful clinical AI assistant. Be brief.'
        }, mockCallbacks);

        // Simulate user saying "Hello"
        const analysis = await orchestrator.processWithAI("Hello, I need to check something.", 'en', mockTelemetry);

        // V2 should successfully generate an analysis object
        expect(analysis).toBeDefined();
        expect(analysis?.intent).toBeDefined();

        // Telemetry marks should be called
        expect(mockTelemetry).toHaveBeenCalledWith('gemini_start');
        expect(mockTelemetry).toHaveBeenCalledWith('gemini_complete');

        // Callbacks should be triggered
        expect(mockCallbacks.onTextReady).toHaveBeenCalled();
    }, 15000); // 15s timeout to allow Gemini network call

    test('Orchestrator triggers emergency fallback on fatal processing failure', async () => {
        const brokenCallbacks = {
            onTextReady: vi.fn(),
            onToolExecution: vi.fn(),
            onFatalError: vi.fn().mockResolvedValue(undefined),
        };

        // Instantiate with a context that will cause processing to fail internally
        const orchestrator = new ToolOrchestrator({
            // Missing prompt will likely cause the LLM to complain, or we force a throw
            systemPrompt: ''
        }, brokenCallbacks);

        // Force an internal error by feeding an intentionally bad payload 
        // or interrupting state. Here we mock `runToolLoop` to throw.
        vi.spyOn(orchestrator as any, 'runToolLoop').mockRejectedValueOnce(new Error('Simulated Crash'));

        const analysis = await orchestrator.processWithAI("Simulate a crash.");

        // It should catch the crash and return null
        expect(analysis).toBeNull();

        // It should have called the fatal error rescue callback
        expect(brokenCallbacks.onFatalError).toHaveBeenCalledWith('escalate', 'Processing failed');
    });

});
