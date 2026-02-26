// ============================================================================
// DENTACORE OS - PHASE 3/4: OUTREACH OUTCOME HANDLER
// Function: outreach-outcome-handler
// Purpose: Process the result of the initial <Gather> (Yes/No)
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Content-Type': 'text/xml',
};

serve(async (req) => {
  const url = new URL(req.url);
  const jobId = url.searchParams.get('job_id');

  // Parse Twilio Form Data
  const formData = await req.formData();
  const speechResult = formData.get('SpeechResult')?.toString().toLowerCase() || '';
  const callSid = formData.get('CallSid')?.toString();

  // Basic Intent Parsing (MVP)
  const isPositive =
    speechResult.includes('yes') ||
    speechResult.includes('schedule') ||
    speechResult.includes('sure') ||
    speechResult.includes('okay');

  let twimlResponse = '';
  let outcome = 'no_answer';

  // Initialize Supabase (Service Role)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (isPositive) {
    outcome = 'interested';
    twimlResponse = `
    <Response>
        <Say voice="alice">Great! A staff member will call you shortly to verify details. Have a wonderful day.</Say>
    </Response>
    `;

    // Create Lead (Phase 4 Logic)
    if (jobId) {
      // Fetch Job Details
      const { data: job } = await supabase
        .from('outreach_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (job) {
        // Update Job
        await supabase
          .from('outreach_jobs')
          .update({
            status: 'completed',
            outcome_summary: `Positive response: "${speechResult}"`,
          })
          .eq('id', jobId);

        // Create Lead
        await supabase.from('lead_queue').insert({
          clinic_id: job.clinic_id,
          patient_id: job.patient_id,
          source_campaign_id: job.campaign_id,
          source_call_id: job.last_call_id, // Might need to update this if NULL
          status: 'new',
          priority: 'high',
          ai_summary: `Patient agreed to recall. Transcript: "${speechResult}"`,
          recommended_action: 'Call to book appointment',
        });
      }
    }
  } else {
    outcome = 'not_interested';
    twimlResponse = `
    <Response>
        <Say voice="alice">No problem. We'll update our records. Take care.</Say>
    </Response>
    `;

    if (jobId) {
      // Update Job
      await supabase
        .from('outreach_jobs')
        .update({
          status: 'completed',
          outcome_summary: `Negative response: "${speechResult}"`,
        })
        .eq('id', jobId);
    }
  }

  // Update Call Record
  if (callSid) {
    await supabase
      .from('ai_calls')
      .update({
        status: 'completed', // Twilio will send final status later, but we mark logic complete
        outcome: outcome,
        transcript: JSON.stringify({ user_response: speechResult }),
      })
      .eq('external_call_id', callSid);
  }

  return new Response(twimlResponse, { headers: corsHeaders });
});
