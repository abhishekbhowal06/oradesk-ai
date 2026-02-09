import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse Twilio webhook data (form-urlencoded)
    const formData = await req.formData();
    const twilioData: Record<string, string> = {};
    formData.forEach((value, key) => {
      twilioData[key] = value.toString();
    });

    const callerPhone = twilioData.From || '';
    const clinicPhone = twilioData.To || '';
    const callSid = twilioData.CallSid || '';

    console.log('Inbound call received:', { callerPhone, clinicPhone, callSid });

    // Lookup clinic by Twilio phone number
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('id, name, phone')
      .eq('twilio_phone_number', clinicPhone)
      .single();

    if (clinicError || !clinic) {
      console.error('Clinic not found for number:', clinicPhone);
      
      // Return error TwiML
      const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    We're sorry, but this number is not configured. Please call the clinic directly.
  </Say>
  <Hangup/>
</Response>`;
      
      return new Response(errorTwiml, {
        headers: { ...corsHeaders, 'Content-Type': 'application/xml' },
      });
    }

    // Try to match caller to existing patient
    const { data: patient } = await supabase
      .from('patients')
      .select('id, first_name, last_name')
      .eq('clinic_id', clinic.id)
      .eq('phone', callerPhone)
      .single();

    // Check for upcoming appointments if patient found
    let upcomingAppointment = null;
    if (patient) {
      const now = new Date().toISOString();
      const { data: appointment } = await supabase
        .from('appointments')
        .select('id, scheduled_at, procedure_name')
        .eq('patient_id', patient.id)
        .eq('clinic_id', clinic.id)
        .gte('scheduled_at', now)
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .single();
      
      upcomingAppointment = appointment;
    }

    // Create ai_calls record for inbound call
    const { data: callRecord, error: callError } = await supabase
      .from('ai_calls')
      .insert({
        clinic_id: clinic.id,
        patient_id: patient?.id || null,
        appointment_id: upcomingAppointment?.id || null,
        phone_number: callerPhone,
        call_type: 'inbound',
        status: 'answered',
        external_call_id: callSid,
        call_started_at: new Date().toISOString(),
        model_version: 'DENT-AI-v3.2.1',
      })
      .select()
      .single();

    if (callError) {
      console.error('Failed to create call record:', callError);
    }

    const callId = callRecord?.id || 'unknown';

    // Build personalized greeting
    let greeting = `Thank you for calling ${clinic.name}.`;
    
    if (patient) {
      greeting = `Hello ${patient.first_name}, thank you for calling ${clinic.name}.`;
      
      if (upcomingAppointment) {
        const appointmentDate = new Date(upcomingAppointment.scheduled_at).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
        greeting += ` I see you have an appointment scheduled for ${appointmentDate}.`;
      }
    }

    // Log analytics event
    await supabase.from('analytics_events').insert({
      clinic_id: clinic.id,
      event_type: 'call_initiated',
      patient_id: patient?.id || null,
      ai_call_id: callRecord?.id || null,
      event_data: { 
        call_type: 'inbound',
        caller_recognized: !!patient,
      },
    });

    // Generate TwiML response with speech recognition
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    ${greeting}
    How can I help you today? You can say: schedule an appointment, cancel an appointment, reschedule, or speak to a staff member.
  </Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${SUPABASE_URL}/functions/v1/twilio-inbound-gather?callId=${callId}&amp;step=intent">
    <Say voice="Polly.Joanna">I'm listening.</Say>
  </Gather>
  <Say voice="Polly.Joanna">
    I didn't catch that. Let me transfer you to our staff.
  </Say>
  <Dial>${clinic.phone || ''}</Dial>
</Response>`;

    return new Response(twiml, {
      headers: { ...corsHeaders, 'Content-Type': 'application/xml' },
    });
  } catch (error) {
    console.error('Error in twilio-inbound:', error);
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    We're experiencing technical difficulties. Please call back or try again later.
  </Say>
  <Hangup/>
</Response>`;

    return new Response(errorTwiml, {
      headers: { ...corsHeaders, 'Content-Type': 'application/xml' },
    });
  }
});
