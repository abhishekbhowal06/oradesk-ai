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

    if (!callId) {
      throw new Error('Missing callId parameter');
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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

    const patientName = call.patients ? `${call.patients.first_name}` : 'there';
    const appointmentDate = call.appointments?.scheduled_at 
      ? new Date(call.appointments.scheduled_at).toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        })
      : 'your upcoming appointment';
    const procedure = call.appointments?.procedure_name || 'your appointment';

    // Generate TwiML for the AI conversation
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    Hello, this is DENTACOR AI calling on behalf of your dental office. 
    Am I speaking with ${patientName}?
  </Say>
  <Gather input="speech" timeout="5" action="${SUPABASE_URL}/functions/v1/twilio-gather?callId=${callId}&step=confirm_identity">
    <Say voice="Polly.Joanna">Please say yes or no.</Say>
  </Gather>
  <Say voice="Polly.Joanna">
    I didn't catch that. I'll try calling back later. Goodbye.
  </Say>
</Response>`;

    return new Response(twiml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml',
      },
    });
  } catch (error) {
    console.error('Error generating TwiML:', error);
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">
    We're sorry, but we're experiencing technical difficulties. 
    Please call our office directly. Goodbye.
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
