/**
 * TOOL EXECUTOR TESTS
 *
 * Tests the core business logic of AI tool execution:
 * - checkAvailability: slot formatting, empty results
 * - bookAppointment: happy path, slot taken, missing args
 * - escalateToHuman: task creation, call flagging
 * - executeTool dispatcher: unknown tool, error handling
 */

// Mock the distributed lock BEFORE importing executor
jest.mock('../lib/distributed-lock', () => ({
    withLock: jest.fn(async (_key: string, fn: () => Promise<any>, _opts?: any) => fn()),
}));

// Mock AppointmentService BEFORE importing executor
jest.mock('../services/data/AppointmentService', () => ({
    appointmentService: {
        findAvailableSlots: jest.fn(),
        bookSlot: jest.fn(),
    },
}));

import { executeTool } from '../tools/executor';
import { supabase } from '../lib/supabase';
import { appointmentService } from '../services/data/AppointmentService';

const mockAppointmentService = appointmentService as jest.Mocked<typeof appointmentService>;
const mockChain = supabase.from('') as any;

describe('Tool Executor', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // ─── checkAvailability ────────────────────────────────────
    describe('checkAvailability', () => {
        test('returns available slots for valid date', async () => {
            (mockAppointmentService.findAvailableSlots as jest.Mock).mockResolvedValueOnce([
                {
                    id: 'slot-1',
                    provider_id: 'dr-1',
                    start_time: '2026-03-20T10:00:00Z',
                    end_time: '2026-03-20T10:30:00Z',
                },
                {
                    id: 'slot-2',
                    provider_id: 'dr-1',
                    start_time: '2026-03-20T11:00:00Z',
                    end_time: '2026-03-20T11:30:00Z',
                },
            ]);

            const result = await executeTool({
                name: 'checkAvailability',
                arguments: {
                    date: '2026-03-20',
                    timePreference: 'morning',
                    clinicId: 'clinic-1',
                },
            });

            expect(result.success).toBe(true);
            expect(result.message).toContain('openings');
            expect((result as any).slots).toHaveLength(2);
        });

        test('returns empty message when no slots available', async () => {
            (mockAppointmentService.findAvailableSlots as jest.Mock).mockResolvedValueOnce([]);

            const result = await executeTool({
                name: 'checkAvailability',
                arguments: {
                    date: '2026-03-25',
                    timePreference: 'afternoon',
                    clinicId: 'clinic-1',
                },
            });

            expect(result.success).toBe(true);
            expect((result as any).slots).toHaveLength(0);
            expect(result.message).toContain("don't have any openings");
        });

        test('returns graceful error when clinicId missing', async () => {
            const result = await executeTool({
                name: 'checkAvailability',
                arguments: {
                    date: '2026-03-20',
                    timePreference: 'morning',
                    clinicId: '',
                },
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('more info');
        });

        test('handles all time preferences without throwing', async () => {
            (mockAppointmentService.findAvailableSlots as jest.Mock).mockResolvedValue([]);

            for (const pref of ['morning', 'afternoon', 'evening', 'any'] as const) {
                await executeTool({
                    name: 'checkAvailability',
                    arguments: { date: '2026-03-20', timePreference: pref, clinicId: 'c1' },
                });
            }

            expect(mockAppointmentService.findAvailableSlots).toHaveBeenCalledTimes(4);
        });
    });

    // ─── bookAppointment ──────────────────────────────────────
    describe('bookAppointment', () => {
        test('books successfully with valid args', async () => {
            (mockAppointmentService.bookSlot as jest.Mock).mockResolvedValueOnce({
                success: true,
                bookingId: 'booking-abc12345-long',
                slot: {
                    id: 'slot-1',
                    provider_id: 'dr-1',
                    start_time: '2026-03-20T10:00:00Z',
                    end_time: '2026-03-20T10:30:00Z',
                },
            });

            const result = await executeTool({
                name: 'bookAppointment',
                arguments: {
                    slotId: 'slot-1',
                    patientId: 'patient-1',
                    reason: 'Routine checkup',
                    callId: 'call-1',
                    clinicId: 'clinic-1',
                },
            });

            expect(result.success).toBe(true);
            expect((result as any).confirmationCode).toMatch(/^DC-/);
            expect(result.message).toContain('all set');
        });

        test('returns graceful message when slot taken', async () => {
            (mockAppointmentService.bookSlot as jest.Mock).mockResolvedValueOnce({
                success: false,
                error: 'Slot is no longer available',
                slot: null,
                bookingId: null,
            });

            const result = await executeTool({
                name: 'bookAppointment',
                arguments: {
                    slotId: 'slot-taken',
                    patientId: 'patient-1',
                    reason: 'Filling',
                    callId: 'call-2',
                    clinicId: 'clinic-1',
                },
            });

            expect(result.success).toBe(false);
            expect((result as any).confirmationCode).toBeNull();
        });

        test('returns error when required args missing', async () => {
            const result = await executeTool({
                name: 'bookAppointment',
                arguments: {
                    slotId: '',
                    patientId: '',
                    reason: '',
                    callId: '',
                    clinicId: '',
                },
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('more details');
        });
    });

    // ─── escalateToHuman ──────────────────────────────────────
    describe('escalateToHuman', () => {
        test('creates staff task and flags call', async () => {
            mockChain.single.mockResolvedValueOnce({
                data: { id: 'task-1' },
                error: null,
            });

            const result = await executeTool({
                name: 'escalateToHuman',
                arguments: {
                    reason: 'Patient is angry about billing',
                    sentiment: 'angry',
                    callId: 'call-5',
                    clinicId: 'clinic-1',
                    patientId: 'patient-2',
                },
            });

            expect(result.success).toBe(true);
            expect((result as any).taskId).toBe('task-1');
            expect(result.message).toContain('connecting');
        });

        test('sets urgent priority for emergency sentiment', async () => {
            mockChain.single.mockResolvedValueOnce({
                data: { id: 'task-2' },
                error: null,
            });

            await executeTool({
                name: 'escalateToHuman',
                arguments: {
                    reason: 'Patient having chest pain',
                    sentiment: 'emergency',
                    callId: 'call-6',
                    clinicId: 'clinic-1',
                    patientId: 'patient-3',
                },
            });

            expect(mockChain.insert).toHaveBeenCalledWith(
                expect.objectContaining({
                    priority: 'urgent',
                    title: expect.stringContaining('EMERGENCY'),
                })
            );
        });
    });

    // ─── Dispatcher ───────────────────────────────────────────
    describe('executeTool dispatcher', () => {
        test('handles unknown tool gracefully', async () => {
            const result = await executeTool({
                name: 'unknownTool' as any,
                arguments: {} as any,
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('connect you');
        });

        test('catches exceptions and returns graceful message', async () => {
            (mockAppointmentService.findAvailableSlots as jest.Mock).mockRejectedValueOnce(
                new Error('Database connection lost')
            );

            const result = await executeTool({
                name: 'checkAvailability',
                arguments: { date: '2026-01-01', timePreference: 'any', clinicId: 'c1' },
            });

            expect(result.success).toBe(false);
            expect(result.message).toContain('taking a moment');
        });
    });
});
