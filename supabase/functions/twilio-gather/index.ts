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
    const url = new URL(req.url);
    const callId = url.searchParams.get('callId');
    const step = url.searchParams.get('step');

    if (!callId) {
      throw new Error('Missing callId parameter');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Parse form data from Twilio
    const formData = await req.formData();
    const speechResult = (formData.get('SpeechResult') as string || '').toLowerCase();

    // Get call details
    const { data: call, error } = await supabase
      .from('ai_calls')
      .select(`
        *,
        patients (first_name, last_name),
        appointments (procedure_name, scheduled_at)
      `)
      .eq('id', callId)
      .single();

    if (error || !call) {
      throw new Error('Call not found');
    }

    const appointmentDate = call.appointments?.scheduled_at 
      ? new Date(call.appointments.scheduled_at).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
      : 'your upcoming appointment';
    const procedure = call.appointments?.procedure_name || 'appointment';

    let twiml = '';
    let transcriptEntry = { role: 'patient', message: speechResult, timestamp: new Date().toISOString() };

    switch (step) {
      case 'confirm_identity': {
        const isYes = speechResult.includes('yes') || speechResult.includes('yeah') || speechResult.includes('speaking') || speechResult.includes('this is');
        
        if (isYes) {
          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    Great! I'm calling to confirm your ${procedure} scheduled for ${appointmentDate}. 
    Can you confirm you'll be attending?
  </Say>
  <Gather input="speech" timeout="5" action="${SUPABASE_URL}/functions/v1/twilio-gather?callId=${callId}&step=confirm_appointment">
    <Say voice="Polly.Joanna">Please say yes to confirm, or no if you need to reschedule.</Say>
  </Gather>
  <Say voice="Polly.Joanna">
    I didn't catch your response. Our office will follow up with you. Goodbye.
  </Say>
</Response>`;
        } else {
          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    I apologize for the inconvenience. We'll try reaching the correct person later. Goodbye.
  </Say>
</Response>`;
          
          // Mark call as needing action
          await supabase.from('ai_calls').update({
            outcome: 'action_needed',
            escalation_required: true,
            escalation_reason: 'Wrong person answered the call',
            confidence_score: 30,
            ai_reasoning: 'Patient identity could not be confirmed. Manual follow-up required.',
          }).eq('id', callId);
        }
        break;
      }

      case 'confirm_appointment': {
        const isConfirmed = speechResult.includes('yes') || speechResult.includes('confirm') || speechResult.includes('will be there') || speechResult.includes('see you');
        const needsReschedule = speechResult.includes('no') || speechResult.includes('reschedule') || speechResult.includes('change') || speechResult.includes('cancel');

        if (isConfirmed) {
          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    Wonderful! Your ${procedure} on ${appointmentDate} is confirmed. 
    We look forward to seeing you. Have a great day!
  </Say>
</Response>`;

          // Update call and appointment
          await supabase.from('ai_calls').update({
            outcome: 'confirmed',
            confidence_score: 95,
            ai_reasoning: 'Patient provided clear verbal confirmation for the appointment.',
            status: 'completed',
            call_ended_at: new Date().toISOString(),
          }).eq('id', callId);

          if (call.appointment_id) {
            await supabase.from('appointments').update({
              status: 'confirmed',
              confirmed_at: new Date().toISOString(),
            }).eq('id', call.appointment_id);
          }

          // Log analytics
          await supabase.from('analytics_events').insert({
            clinic_id: call.clinic_id,
            event_type: 'appointment_confirmed',
            patient_id: call.patient_id,
            appointment_id: call.appointment_id,
            ai_call_id: callId,
          });

        } else if (needsReschedule) {
          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    I understand you need to reschedule. Our front desk team will call you shortly to find a better time. 
    Thank you for letting us know. Goodbye.
  </Say>
</Response>`;

          await supabase.from('ai_calls').update({
            outcome: 'action_needed',
            escalation_required: true,
            escalation_reason: 'Patient requested to reschedule appointment',
            confidence_score: 85,
            ai_reasoning: 'Patient indicated they cannot make the scheduled time and needs rescheduling.',
            status: 'completed',
            call_ended_at: new Date().toISOString(),
          }).eq('id', callId);

          // Create staff task
          await supabase.from('staff_tasks').insert({
            clinic_id: call.clinic_id,
            patient_id: call.patient_id,
            appointment_id: call.appointment_id,
            ai_call_id: callId,
            title: `Reschedule: ${call.patients?.first_name} ${call.patients?.last_name}`,
            description: `Patient requested to reschedule their ${procedure} originally scheduled for ${appointmentDate}.`,
            priority: 'high',
            ai_generated: true,
            status: 'pending',
          });

        } else {
          twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    I'm sorry, I didn't quite understand. Let me have our office follow up with you directly. 
    Thank you for your time. Goodbye.
  </Say>
</Response>`;

          await supabase.from('ai_calls').update({
            outcome: 'action_needed',
            escalation_required: true,
            escalation_reason: 'Unable to understand patient response',
            confidence_score: 50,
            ai_reasoning: `Could not parse patient response: "${speechResult}". Manual follow-up recommended.`,
            status: 'completed',
            call_ended_at: new Date().toISOString(),
          }).eq('id', callId);
        }
        break;
      }

      default:
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    Thank you for your time. Goodbye.
  </Say>
</Response>`;
    }

    // Update transcript
    const existingTranscript = (call.transcript as Array<{ role: string; message: string; timestamp: string }>) || [];
    existingTranscript.push(transcriptEntry);
    await supabase.from('ai_calls').update({
      transcript: existingTranscript,
    }).eq('id', callId);

    return new Response(twiml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
      },
    });
  } catch (error) {
    console.error('Error in gather handler:', error);
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    We're experiencing technical difficulties. Our office will contact you shortly. Goodbye.
  </Say>
</Response>`;

    return new Response(errorTwiml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
      },
    });
  }
});
