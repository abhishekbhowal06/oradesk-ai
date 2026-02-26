import { appointmentService } from '../AppointmentService';
import { supabase } from '../../../lib/supabase';

// Helper to cast the mock chain
const mockChain = supabase.from('') as any;

describe('AppointmentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('findAvailableSlots returns slots', async () => {
    // Mock chain: from -> select -> eq -> eq -> gte -> lte -> order -> limit -> then
    // We need to intercept the final resolution.

    // Since `setup.ts` returns a default { data: [], error: null } for `then`,
    // we can override the behavior for check.

    // However, `mockSupabaseChain` in setup.ts is one object reused.
    // So we can mock implementation of `then` on it?
    // Or just mock `limit` since that is the last call before await?
    // In `findAvailableSlots`: .limit(limit) is awaited.

    // Let's override limit to resolve custom data.
    mockChain.limit.mockImplementationOnce(() => ({
      then: (resolve: any) =>
        resolve({
          data: [{ id: '1', start_time: '2024-01-01T10:00:00Z' }],
          error: null,
        }),
    }));

    const slots = await appointmentService.findAvailableSlots('clinic_1', new Date(), new Date());
    expect(slots).toHaveLength(1);
    expect(slots[0].id).toBe('1');
  });

  test('bookSlot handles locking correctly', async () => {
    // 1. Check Availability (single())
    mockChain.single.mockResolvedValueOnce({
      data: { id: 'slot_1', status: 'available' },
      error: null,
    });

    // 2. Lock (update...eq)
    // update returns chain. eq returns chain.
    // eventual await triggers `then`.
    // default `then` returns { data: [], error: null }, which is fine for update.

    // 3. Create Booking (insert...single)
    mockChain.single.mockResolvedValueOnce({
      data: { id: 'booking_1' },
      error: null,
    });

    // 4. Finalize (update...eq) -> default then.

    const result = await appointmentService.bookSlot('c1', 's1', 'p1', 'call1', 'Routine');

    expect(result.success).toBe(true);
    expect(result.bookingId).toBe('booking_1');

    // Verify lock call
    expect(mockChain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'locked' }));
  });
});
