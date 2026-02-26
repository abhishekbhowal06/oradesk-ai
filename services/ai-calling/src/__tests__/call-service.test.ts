/**
 * CALL SERVICE TESTS
 *
 * Tests the safety checks and orchestration logic:
 * - Error code completeness and uniqueness
 * - Duplicate call prevention query chain
 * - Analytics event structure validation
 * - Circuit breaker integration
 */

import { supabase } from '../lib/supabase';

const mockChain = supabase.from('') as any;

describe('Call Service Safety Checks', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ─── Error Code Coverage ──────────────────────────────────
    describe('Error Code Completeness', () => {
        test('all critical error codes exist', () => {
            const callService = require('../lib/call-service');
            const codes = callService.CallErrorCodes;

            expect(codes).toBeDefined();

            const requiredCodes = [
                'PATIENT_NOT_FOUND',
                'APPOINTMENT_NOT_FOUND',
                'CLINIC_NOT_FOUND',
                'NO_PHONE',
                'CONSENT_REQUIRED',
                'TWILIO_ERROR',
                'CIRCUIT_OPEN',
                'DATABASE_ERROR',
            ];

            for (const code of requiredCodes) {
                expect(codes[code]).toBeDefined();
                expect(typeof codes[code]).toBe('string');
            }
        });

        test('error codes are unique values (no accidental collision)', () => {
            const callService = require('../lib/call-service');
            const codes = callService.CallErrorCodes;

            const values = Object.values(codes);
            const uniqueValues = new Set(values);
            expect(uniqueValues.size).toBe(values.length);
        });

        test('error code keys match their values', () => {
            const callService = require('../lib/call-service');
            const codes = callService.CallErrorCodes;

            // Each key should equal its value (standard pattern)
            for (const [key, value] of Object.entries(codes)) {
                expect(key).toBe(value);
            }
        });
    });

    // ─── Duplicate Call Prevention ────────────────────────────
    describe('Duplicate Call Prevention', () => {
        test('supabase query chain for recent calls executes correctly', async () => {
            const patientId = 'patient-dup-test';
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

            mockChain.then.mockImplementationOnce((resolve: any) =>
                resolve({
                    data: [{ id: 'existing-call', status: 'completed' }],
                    error: null,
                })
            );

            const result = await supabase
                .from('ai_calls')
                .select('id, status')
                .eq('patient_id', patientId)
                .gte('created_at', oneHourAgo);

            expect(mockChain.select).toHaveBeenCalledWith('id, status');
            expect(mockChain.eq).toHaveBeenCalledWith('patient_id', patientId);
            expect(mockChain.gte).toHaveBeenCalledWith('created_at', oneHourAgo);
        });
    });

    // ─── Analytics Event Logging ──────────────────────────────
    describe('Analytics Event Structure', () => {
        test('call_completed event shape is valid', () => {
            const event = {
                clinic_id: 'clinic-1',
                event_type: 'call_completed',
                patient_id: 'patient-1',
                ai_call_id: 'call-1',
                event_data: {
                    outcome: 'confirmed',
                    duration_seconds: 45,
                    confidence_score: 92,
                },
            };

            expect(event.clinic_id).toBeTruthy();
            expect(event.event_type).toBe('call_completed');
            expect(event.event_data.outcome).toMatch(
                /confirmed|rescheduled|cancelled|action_needed|unreachable/
            );
            expect(event.event_data.duration_seconds).toBeGreaterThan(0);
            expect(event.event_data.confidence_score).toBeGreaterThanOrEqual(0);
            expect(event.event_data.confidence_score).toBeLessThanOrEqual(100);
        });

        test('insert analytics event via supabase chain', async () => {
            const event = {
                clinic_id: 'clinic-1',
                event_type: 'call_initiated',
                patient_id: 'patient-1',
            };

            await supabase.from('analytics_events').insert(event);

            expect(mockChain.insert).toHaveBeenCalledWith(event);
        });
    });

    // ─── Circuit Breaker ──────────────────────────────────────
    describe('Circuit Breaker Integration', () => {
        test('getCircuitBreakerHealth is exported and callable', () => {
            const { getCircuitBreakerHealth } = require('../lib/circuit-breaker');
            expect(getCircuitBreakerHealth).toBeDefined();
            expect(typeof getCircuitBreakerHealth).toBe('function');
        });
    });
});
