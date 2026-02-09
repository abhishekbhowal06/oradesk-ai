import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Intent detection patterns
const INTENT_PATTERNS = {
  book: ['schedule', 'book', 'appointment', 'new appointment', 'make an appointment'],
  cancel: ['cancel', 'cancellation'],
  reschedule: ['reschedule', 'change', 'move', 'different time', 'different day'],
  transfer: ['speak', 'person', 'human', 'staff', 'someone', 'representative', 'operator', 'help'],
};

function detectIntent(speech: string): string {
  const lowerSpeech = speech.toLowerCase();
  
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (lowerSpeech.includes(pattern)) {
        return intent;
      }
    }
  }
  
  return 'unclear';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse URL params
    const url = new URL(req.url);
    const callId = url.searchParams.get('callId') || '';
    const step = url.searchParams.get('step') || 'intent';

    // Parse Twilio form data
    const formData = await req.formData();
    const twilioData: Record<string, string> = {};
    formData.forEach((value, key) => {
      twilioData[key] = value.toString();
    });

    const speechResult = twilioData.SpeechResult || '';
    const confidence = parseFloat(twilioData.Confidence || '0');

    console.log('Inbound gather:', { callId, step, speechResult, confidence });

    // Get call record for context
    const { data: call } = await supabase
      .from('ai_calls')
      .select(`
        *,
        clinic:clinics (id, name, phone),
        patient:patients (id, first_name, last_name)
      `)
      .eq('id', callId)
      .single();

    const clinicPhone = call?.clinic?.phone || '';
    const clinicName = call?.clinic?.name || 'the clinic';

    // Update call transcript
    if (call) {
      const existingTranscript = (call.transcript as any[]) || [];
      existingTranscript.push({
        role: 'patient',
        content: speechResult,
        step,
        confidence,
        timestamp: new Date().toISOString(),
      });

      await supabase
        .from('ai_calls')
        .update({ transcript: existingTranscript })
        .eq('id', callId);
    }

    let twiml = '';

    switch (step) {
      case 'intent': {
        const intent = detectIntent(speechResult);
        console.log('Detected intent:', intent);

        switch (intent) {
          case 'book':
            twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    I'd be happy to help you schedule an appointment. 
    What day works best for you? You can say something like "next Monday" or "this Friday".
  </Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${SUPABASE_URL}/functions/v1/twilio-inbound-gather?callId=${callId}&amp;step=book_date">
    <Say voice="Polly.Joanna">I'm listening.</Say>
  </Gather>
  <Say voice="Polly.Joanna">I didn't catch that. Let me transfer you to our staff.</Say>
  <Dial>${clinicPhone}</Dial>
</Response>`;
            break;

          case 'cancel':
            if (call?.patient) {
              // Check for upcoming appointments
              const { data: appointments } = await supabase
                .from('appointments')
                .select('id, scheduled_at, procedure_name')
                .eq('patient_id', call.patient.id)
                .eq('clinic_id', call.clinic?.id)
                .gte('scheduled_at', new Date().toISOString())
                .in('status', ['scheduled', 'confirmed'])
                .order('scheduled_at', { ascending: true })
                .limit(3);

              if (appointments && appointments.length > 0) {
                const apptList = appointments.map((a, i) => {
                  const date = new Date(a.scheduled_at).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  });
                  return `${i + 1}: ${a.procedure_name} on ${date}`;
                }).join('. ');

                twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    I found the following upcoming appointments: ${apptList}. 
    Which one would you like to cancel? Please say the number.
  </Say>
  <Gather input="speech" timeout="5" speechTimeout="auto" action="${SUPABASE_URL}/functions/v1/twilio-inbound-gather?callId=${callId}&amp;step=confirm_cancel">
    <Say voice="Polly.Joanna">I'm listening.</Say>
  </Gather>
  <Say voice="Polly.Joanna">I didn't catch that. Let me transfer you to our staff.</Say>
  <Dial>${clinicPhone}</Dial>
</Response>`;
              } else {
                twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    I don't see any upcoming appointments for you. Let me transfer you to our staff to help further.
  </Say>
  <Dial>${clinicPhone}</Dial>
</Response>`;
              }
            } else {
              twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    To cancel an appointment, I'll need to transfer you to our staff who can look up your records.
  </Say>
  <Dial>${clinicPhone}</Dial>
</Response>`;
            }
            break;

          case 'reschedule':
            twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    I'd be happy to help you reschedule. Let me transfer you to our scheduling team who can find the best available time for you.
  </Say>
  <Dial>${clinicPhone}</Dial>
</Response>`;
            break;

          case 'transfer':
            twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    Of course, let me connect you with our staff right away.
  </Say>
  <Dial>${clinicPhone}</Dial>
</Response>`;
            break;

          default:
            // Unclear intent - create staff task and transfer
            if (call?.clinic?.id) {
              await supabase.from('staff_tasks').insert({
                clinic_id: call.clinic.id,
                patient_id: call.patient?.id || null,
                title: 'Inbound call - unclear intent',
                description: `Patient said: "${speechResult}". AI could not determine intent. Call was transferred to staff.`,
                priority: 'medium',
                ai_generated: true,
                ai_call_id: callId,
                status: 'pending',
              });

              await supabase
                .from('ai_calls')
                .update({
                  escalation_required: true,
                  escalation_reason: `Unclear intent: "${speechResult}"`,
                })
                .eq('id', callId);

              await supabase.from('analytics_events').insert({
                clinic_id: call.clinic.id,
                event_type: 'escalation_created',
                patient_id: call.patient?.id || null,
                ai_call_id: callId,
                event_data: { reason: 'unclear_intent', speech: speechResult },
              });
            }

            twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    I want to make sure I help you correctly. Let me transfer you to our staff.
  </Say>
  <Dial>${clinicPhone}</Dial>
</Response>`;
        }
        break;
      }

      case 'book_date': {
        // For MVP, transfer to staff for actual booking
        // Future: integrate with calendar availability
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    Got it. Let me transfer you to our scheduling team who can check availability and confirm your appointment for ${speechResult}.
  </Say>
  <Dial>${clinicPhone}</Dial>
</Response>`;

        // Log the booking request
        if (call?.clinic?.id) {
          await supabase.from('staff_tasks').insert({
            clinic_id: call.clinic.id,
            patient_id: call.patient?.id || null,
            title: 'Appointment booking request',
            description: `Patient requested to book an appointment for: ${speechResult}. Call was transferred to staff.`,
            priority: 'medium',
            ai_generated: true,
            ai_call_id: callId,
            status: 'pending',
          });
        }
        break;
      }

      case 'confirm_cancel': {
        // For MVP, transfer to staff for cancellation
        // Future: directly cancel the appointment
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    Let me transfer you to our staff to complete this cancellation and ensure everything is updated correctly.
  </Say>
  <Dial>${clinicPhone}</Dial>
</Response>`;

        // Log the cancellation request
        if (call?.clinic?.id) {
          await supabase.from('staff_tasks').insert({
            clinic_id: call.clinic.id,
            patient_id: call.patient?.id || null,
            title: 'Appointment cancellation request',
            description: `Patient requested to cancel appointment: ${speechResult}. Call was transferred to staff.`,
            priority: 'high',
            ai_generated: true,
            ai_call_id: callId,
            status: 'pending',
          });
        }
        break;
      }

      default:
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    Let me transfer you to our staff.
  </Say>
  <Dial>${clinicPhone}</Dial>
</Response>`;
    }

    return new Response(twiml, {
      headers: { ...corsHeaders, 'Content-Type': 'application/xml' },
    });
  } catch (error) {
    console.error('Error in twilio-inbound-gather:', error);
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    I'm sorry, we're experiencing technical difficulties. Please call back shortly.
  </Say>
  <Hangup/>
</Response>`;

    return new Response(errorTwiml, {
      headers: { ...corsHeaders, 'Content-Type': 'application/xml' },
    });
  }
});
