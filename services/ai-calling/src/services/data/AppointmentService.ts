import { supabase } from '../../lib/supabase';
import { logger } from '../../lib/logging/structured-logger';
import { Appointment, BookingResult } from '../../types';

// Map 'Appointment' to 'AvailableSlot' concept for this service if needed,
// or just use Appointment.
// The code uses 'AvailableSlot' which matches 'pms_slots' table structure.
// 'Appointment' in types/index.ts matches 'appointments' table.
// available slot != appointment.
// Let's keep AvailableSlot local OR add it to types?
// 'pms_slots' -> 'AvailableSlot'.
// Let's add AvailableSlot to types/index.ts to be clean.
import { AvailableSlot } from '../../types';

export class AppointmentService {
  private logger = logger.child({ module: 'AppointmentService' });

  /**
   * Find available slots for a given date and time range
   */
  async findAvailableSlots(
    clinicId: string,
    startDate: Date,
    endDate: Date,
    limit = 5,
  ): Promise<AvailableSlot[]> {
    try {
      const { data, error } = await supabase
        .from('pms_slots')
        .select('id, provider_id, start_time, end_time, status')
        .eq('clinic_id', clinicId)
        .or(`status.eq.available,and(status.eq.locked,locked_until.lt.${new Date().toISOString()})`)
        .gte('start_time', startDate.toISOString())
        .lte('start_time', endDate.toISOString())
        .order('start_time', { ascending: true })
        .limit(limit);

      if (error) {
        this.logger.error('Error finding slots', { clinicId, error });
        return [];
      }

      return data as AvailableSlot[];
    } catch (err) {
      this.logger.error('findAvailableSlots exception', { clinicId, error: err });
      return [];
    }
  }

  /**
   * Book a specific slot for a patient
   */
  async bookSlot(
    clinicId: string,
    slotId: string,
    patientId: string,
    callId: string,
    reason: string,
  ): Promise<BookingResult> {
    const SLOT_LOCK_MINUTES = 10;

    // 1. Check availability (Atomic)
    const { data: slot, error: slotError } = await supabase
      .from('pms_slots')
      .select('*')
      .eq('id', slotId)
      .or(`status.eq.available,and(status.eq.locked,locked_until.lt.${new Date().toISOString()})`)
      .single();

    if (slotError || !slot) {
      return { success: false, error: 'Slot no longer available' };
    }

    // 2. Lock Slot
    const lockUntil = new Date(Date.now() + SLOT_LOCK_MINUTES * 60000);
    const { error: lockError } = await supabase
      .from('pms_slots')
      .update({
        status: 'locked',
        locked_until: lockUntil.toISOString(),
        locked_by_call_id: callId,
      })
      .eq('id', slotId)
      .or(`status.eq.available,and(status.eq.locked,locked_until.lt.${new Date().toISOString()})`);

    if (lockError) {
      return { success: false, error: 'Failed to lock slot' };
    }

    // 3. Create Booking
    const { data: booking, error: bookingError } = await supabase
      .from('booking_attempts')
      .insert({
        clinic_id: clinicId,
        call_id: callId,
        slot_id: slotId,
        patient_id: patientId,
        status: 'accepted',
      })
      .select('id')
      .single();

    if (bookingError) {
      // Rollback lock
      await supabase.from('pms_slots').update({ status: 'available' }).eq('id', slotId);
      return { success: false, error: 'Failed to create booking record' };
    }

    // 4. Finalize Slot
    await supabase
      .from('pms_slots')
      .update({ status: 'booked', locked_until: null })
      .eq('id', slotId);

    // 5. Analytics
    // (Async fire-and-forget to not block response)
    this.logBookingAnalytics(clinicId, patientId, callId, slot, booking.id, reason);

    // 6. Schedule Confirmation Loop
    // (Async fire-and-forget)
    // Dynamic import to avoid circular dependency potentially, or just direct if clean.
    // Given structure, it might be fine, but let's be safe.
    try {
      const { careLoopEngine } = require('../../lib/engines/care-loop');
      careLoopEngine.scheduleConfirmation(clinicId, patientId, booking.id, slot.start_time);
    } catch (err) {
      this.logger.error('Failed to schedule confirmation loop', { error: err });
    }

    return {
      success: true,
      bookingId: booking.id,
      slot: slot as AvailableSlot,
    };
  }

  private async logBookingAnalytics(
    clinicId: string,
    patientId: string,
    callId: string,
    slot: any,
    bookingId: string,
    reason: string,
  ) {
    await supabase.from('analytics_events').insert({
      clinic_id: clinicId,
      event_type: 'appointment_booked',
      patient_id: patientId,
      ai_call_id: callId,
      event_data: {
        slot_id: slot.id,
        booking_id: bookingId,
        booked_time: slot.start_time,
        reason,
        source: 'ai_call',
      },
    });
  }
}

export const appointmentService = new AppointmentService();
