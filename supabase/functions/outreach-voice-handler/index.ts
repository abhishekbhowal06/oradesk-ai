// ============================================================================
// DENTACORE OS - PHASE 3: OUTREACH VOICE HANDLER
// Function: outreach-voice-handler
// Purpose: Generate TwiML for AI Recall Calls
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Content-Type': 'text/xml',
};

serve(async (req) => {
  // Parsing Query Params
  const url = new URL(req.url);
  const patientName = url.searchParams.get('patient_name') || 'there';
  const jobId = url.searchParams.get('job_id');

  // Hardcoded Clinic Name for MVP (Could fetch from DB using job_id)
  const clinicName = 'Dental One Center';

  // Simple TwiML
  // In a real scenario, this would potentially:
  // 1. Connect to websocket (Stream) for realtime AI
  // 2. Or use <Gather> for speech-to-text

  // For MVP Phase 3 start: Use <Gather> + <Say> to prove flow
  const twiml = `
  <Response>
    <Pause length="1"/>
    <Say voice="alice">Hi, this is ${clinicName} calling for ${patientName}.</Say>
    <Pause length="1"/>
    <Say voice="alice">We noticed it's been a while since your last visit. Would you like to schedule a check-up?</Say>
    <Gather input="speech" action="${Deno.env.get('APP_BASE_URL')}/functions/v1/outreach-outcome-handler?job_id=${jobId}" timeout="5">
      <Say voice="alice">Please say yes or no.</Say>
    </Gather>
    <Say voice="alice">I didn't hear a response. We will try again later. Goodbye.</Say>
  </Response>
  `;

  return new Response(twiml, { headers: corsHeaders });
});
