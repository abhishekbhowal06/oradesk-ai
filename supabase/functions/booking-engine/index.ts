// ============================================================================
// DENTACORE OS - PHASE 7: BOOKING ENGINE (EDGE FUNCTION)
// Function: booking-engine
// Purpose: Handle atomic slot locking and confirmation logic
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

// Constants
const SLOT_LOCK_DURATION_MINUTES = 5;

// Types
interface LockRequest {
  action: 'lock';
  call_id: string; // The active AI call (to map the lock)
  slot_id: string;
}

interface ConfirmRequest {
  action: 'confirm';
  call_id: string;
  slot_id: string;
  patient_id: string;
  notes?: string;
}

interface GetSlotsRequest {
  action: 'get_slots';
  clinic_id: string;
  start_date: string; // ISO 8601
  end_date: string; // ISO 8601
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Must use service_role for RLS bypass on locking
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    const action = payload.action;

    // --------------------------------------------------------------------
    // ACTION: GET SLOTS
    // --------------------------------------------------------------------
    if (action === 'get_slots') {
      const { clinic_id, start_date, end_date } = payload as GetSlotsRequest;

      // 1. Clean up expired locks first (Lazy cleanup)
      await supabase
        .from('pms_slots')
        .update({ status: 'available', locked_until: null, locked_by_call_id: null })
        .eq('status', 'locked')
        .lt('locked_until', new Date().toISOString());

      // 2. FETCH FROM LOCAL BRIDGE (Tunnel)
      // In production, this URL is stored in Vault/Secrets per clinic
      const BRIDGE_URL = 'https://dentacore-mock-bridge.loca.lt';

      try {
        console.log(`fetching slots from ${BRIDGE_URL}...`);
        const bridgeRes = await fetch(
          `${BRIDGE_URL}/slots?start=${start_date || ''}&end=${end_date || ''}`,
          {
            headers: { 'ngrok-skip-browser-warning': 'true' }, // often needed for tunnels
          },
        );

        if (bridgeRes.ok) {
          const bridgeData = await bridgeRes.json();

          // 3. Upsert Slots into Supabase Cache
          // We only "add" or "update" availability. Locked slots are respected.
          if (bridgeData && bridgeData.slots && Array.isArray(bridgeData.slots)) {
            const slotsToUpsert = bridgeData.slots.map((s: any) => ({
              clinic_id: clinic_id,
              provider_id: s.provider,
              start_time: s.start,
              end_time: s.end,
              status: 'available', // Reset to available if PMS says so? Careful with locks.
              last_synced_at: new Date().toISOString(),
            }));

            // For MVP: Simple Insert. Real-world: careful merge.
            // We rely on "ON CONFLICT DO NOTHING" or similar if we could.
            // Here, we just query what we have.
          }

          // Return what the bridge says (Direct Proxy for now to ensure freshness)
          return new Response(JSON.stringify({ slots: bridgeData.slots }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } catch (err) {
        console.error('Bridge Connection Failed:', err);
        // Fallback to what's in DB if bridge fails?
      }

      // Fallback: Query DB if bridge failed
      const { data: slots, error } = await supabase
        .from('pms_slots')
        .select('*')
        .eq('clinic_id', clinic_id)
        .eq('status', 'available')
        .gte('start_time', start_date)
        .lte('end_time', end_date)
        .order('start_time', { ascending: true })
        .limit(50);

      if (error) throw error;

      return new Response(JSON.stringify({ slots }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --------------------------------------------------------------------
    // ACTION: LOCK SLOT (Atomic)
    // --------------------------------------------------------------------
    if (action === 'lock') {
      const { call_id, slot_id } = payload as LockRequest;

      // 1. Check if slot is truly available
      // We use RPC or a careful update with conditions to prevent race conditions
      // Ideally: encapsulate in a Postgres transaction or function.
      // For MVP: Use conditional update.

      const lockUntil = new Date();
      lockUntil.setMinutes(lockUntil.getMinutes() + SLOT_LOCK_DURATION_MINUTES);

      const { data: slot, error: updateError } = await supabase
        .from('pms_slots')
        .update({
          status: 'locked',
          locked_until: lockUntil.toISOString(),
          locked_by_call_id: call_id,
        })
        .eq('id', slot_id)
        .eq('status', 'available') // CRITICAL: Only lock if available
        .select()
        .single();

      if (updateError || !slot) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Slot no longer available',
            code: 'SLOT_TAKEN',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      // Create Audit Attempt
      await supabase.from('booking_attempts').insert({
        call_id,
        slot_id,
        status: 'offer_sent', // Slot is now offered/locked
      });

      return new Response(
        JSON.stringify({
          success: true,
          slot,
          expires_at: lockUntil,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // --------------------------------------------------------------------
    // ACTION: CONFIRM BOOKING (Write-Back)
    // --------------------------------------------------------------------
    if (action === 'confirm') {
      const { call_id, slot_id, patient_id, notes } = payload as ConfirmRequest;

      // --- SAFETY GUARDRAIL: patient identity check ---
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .select('first_name, last_name, phone')
        .eq('id', patient_id)
        .single();

      if (patientError || !patient) {
        throw new Error('Patient identity could not be verified');
      }

      // 1. Verify Lock Ownership & Freshness
      const { data: slot, error: slotError } = await supabase
        .from('pms_slots')
        .select('*')
        .eq('id', slot_id)
        .single();

      if (slotError || !slot) throw new Error('Slot not found');

      // Must be locked by THIS call
      if (slot.status !== 'locked' || slot.locked_by_call_id !== call_id) {
        // In production, we might attempt a last-second lock if it just expired
        throw new Error('Slot lock expired or owned by another session. Re-fetch availability.');
      }

      const now = new Date();
      if (slot.locked_until && new Date(slot.locked_until) < now) {
        throw new Error('Reservation expired. Please select a new time.');
      }

      // 2. CALL REAL-WORLD PMS (Proxy via Tunnel)
      const BRIDGE_URL = 'https://dentacore-mock-bridge.loca.lt';

      try {
        const pmsRes = await fetch(`${BRIDGE_URL}/appointments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': 'true',
          },
          body: JSON.stringify({
            patient_id: patient_id,
            patient_name: `${patient.first_name} ${patient.last_name}`,
            start_time: slot.start_time,
            end_time: slot.end_time,
            provider_id: slot.provider_id,
            notes: notes,
          }),
        });

        if (!pmsRes.ok) {
          const pmsErr = await pmsRes.json();
          throw new Error(`PMS Write Failure: ${pmsErr.error || 'Unknown error'}`);
        }

        const pmsData = await pmsRes.json();
        const pms_appointment_id = pmsData.appointment_id;

        // 3. Update Slot to BOOKED
        const { error: finalUpdateError } = await supabase
          .from('pms_slots')
          .update({
            status: 'booked',
            pms_slot_id: pms_appointment_id,
            locked_until: null,
            locked_by_call_id: null,
          })
          .eq('id', slot_id);

        if (finalUpdateError) throw finalUpdateError;

        // 4. Update Booking Attempt Status
        await supabase
          .from('booking_attempts')
          .update({ status: 'confirmed', pms_appointment_id })
          .eq('call_id', call_id)
          .eq('slot_id', slot_id);

        // 5. Create Internal Appointment Record (Mirror)
        await supabase.from('appointments').insert({
          clinic_id: slot.clinic_id,
          patient_id: patient_id,
          scheduled_at: slot.start_time,
          status: 'confirmed',
          notes: `AI Booking confirmed. PMS ID: ${pms_appointment_id}. Call: ${call_id}`,
        });

        return new Response(
          JSON.stringify({
            success: true,
            appointment_id: pms_appointment_id,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      } catch (err: any) {
        console.error('PMS Write Failed - Rolling back lock:', err);

        // FAIL-SAFE: Rollback lock if write failed so slot is available for others
        await supabase
          .from('pms_slots')
          .update({ status: 'available', locked_until: null, locked_by_call_id: null })
          .eq('id', slot_id);

        throw err;
      }
    }

    // --------------------------------------------------------------------
    // ACTION: ANALYZE PATIENT INTENT (Behavioral Memory)
    // --------------------------------------------------------------------
    if (action === 'analyze_patient_intent') {
      const { call_id, patient_id, urgency, emotion, objection, booking_intent_score } = payload;

      // 1. Log to Intent Log (Timeline)
      await supabase.from('conversation_intent_logs').insert({
        call_id,
        patient_id,
        detected_urgency: urgency,
        detected_emotion: emotion,
        objection_detected: objection,
        booking_intent_score,
      });

      // 2. Update/Upsert Behavioral Profile (Memory)
      const { error: profileError } = await supabase.from('patient_behavioral_profiles').upsert(
        {
          patient_id,
          clinic_id: payload.clinic_id,
          last_urgency_level: urgency,
          last_emotional_state: emotion,
          booking_probability: booking_intent_score,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'patient_id' },
      );

      if (profileError) throw profileError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --------------------------------------------------------------------
    // ACTION: GET STRATEGIC SLOTS (Revenue Optimization)
    // --------------------------------------------------------------------
    if (action === 'get_strategic_slots') {
      const { clinic_id, urgency, treatment_value } = payload;

      // 1. Fetch RAW slots from Bridge or Cache
      // (Assuming we use the same logic as get_slots but with filtering)
      const BRIDGE_URL = 'https://dentacore-mock-bridge.loca.lt';
      const bridgeRes = await fetch(`${BRIDGE_URL}/slots`, {
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });

      let slots = [];
      if (bridgeRes.ok) {
        const data = await bridgeRes.json();
        slots = data.slots;
      }

      // 2. APPLY CLINICAL STRATEGY
      // Logic:
      // - If EMERGENCY: Offer the EARLIEST available slots regardless of "value".
      // - If HIGH VALUE: Prefer "Prime Slots" (10am, 2pm) or Doctor-only operators.
      // - If ROUTINE: Offer "Gaps" or low-demand times first (late afternoon).

      let strategicSlots = slots;

      if (urgency === 'emergency') {
        strategicSlots = slots.slice(0, 2); // Top 2 earliest
      } else if (treatment_value === 'high') {
        // Mock strategy: Prefer midday slots
        strategicSlots = slots
          .filter((s: any) => {
            const hour = new Date(s.start).getHours();
            return hour >= 10 && hour <= 14;
          })
          .slice(0, 2);
      } else {
        // Routine: Offer later slots or gaps
        strategicSlots = slots.slice(-2);
      }

      // Fallback if strategy returns nothing
      if (strategicSlots.length === 0) strategicSlots = slots.slice(0, 2);

      return new Response(JSON.stringify({ slots: strategicSlots }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid Action');
  } catch (error) {
    console.error('Error in booking-engine:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
