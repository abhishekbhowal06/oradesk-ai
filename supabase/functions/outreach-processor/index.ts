// ============================================================================
// DENTACORE OS - PHASE 3: OUTREACH PROCESSOR
// Function: outreach-processor
// Purpose: Poll pending outreach jobs and execute Twilio calls
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Need service role for worker tasks
    const twilioSid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN')!;
    const twilioPhone = Deno.env.get('TWILIO_PHONE_NUMBER')!;
    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://your-project.supabase.co'; // Helper for webhooks

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting outreach processor run...');

    // 1. Fetch Pending Jobs with Clinic & Campaign context
    const { data: jobs, error: jobsError } = await supabase
      .from('outreach_jobs')
      .select(
        `
                id, clinic_id, campaign_id, patient_id, attempt_count, max_attempts, channel,
                patients (first_name, last_name, phone, status),
                clinics (timezone, working_hours),
                campaigns (allowed_hours_start, allowed_hours_end)
            `,
      )
      .in('status', ['pending', 'scheduled'])
      .lte('scheduled_for', new Date().toISOString())
      .lt('attempt_count', 3)
      .limit(10);

    if (jobsError) throw jobsError;

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending jobs found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${jobs.length} jobs...`);
    const results = [];

    // 2. Process Batch
    for (const job of jobs) {
      const patient = job.patients;
      const clinic = job.clinics;
      const campaign = job.campaigns;

      // --- SAFETY GUARDRAIL: IDENTITY & DNC ---
      if (!patient?.phone) {
        await markJobFailed(supabase, job.id, 'Missing phone number');
        results.push({ job_id: job.id, status: 'failed', reason: 'missing_phone' });
        continue;
      }

      if (patient.status === 'inactive' || patient.status === 'unreachable') {
        await markJobFailed(supabase, job.id, `Patient status is ${patient.status} - DNC enforced`);
        results.push({ job_id: job.id, status: 'skipped', reason: 'dnc_status' });
        continue;
      }

      // --- SAFETY GUARDRAIL: TIMEZONE ENFORCEMENT ---
      const timezone = clinic?.timezone || 'America/New_York';
      const nowInClinic = new Date().toLocaleString('en-US', { timeZone: timezone });
      const clinicDate = new Date(nowInClinic);
      const currentHour = clinicDate.getHours();

      // Default to 9am-5pm if not specified
      const startHour = campaign?.allowed_hours_start
        ? parseInt(campaign.allowed_hours_start.split(':')[0])
        : 9;
      const endHour = campaign?.allowed_hours_end
        ? parseInt(campaign.allowed_hours_end.split(':')[0])
        : 17;

      if (currentHour < startHour || currentHour >= endHour) {
        console.log(
          `Job ${job.id} skipped - Outside safe hours for ${timezone} (${currentHour}:00)`,
        );
        // Reschedule for later (e.g. next hour or next day)
        await markJobRetry(supabase, job.id, job.attempt_count, 'Outside safe hours - rescheduled');
        results.push({ job_id: job.id, status: 'rescheduled', reason: 'outside_hours' });
        continue;
      }

      try {
        // 3. Initiate Twilio Call
        const webhookUrl = `${appBaseUrl}/functions/v1/outreach-voice-handler?job_id=${job.id}&patient_name=${encodeURIComponent(patient.first_name)}`;

        const body = new URLSearchParams({
          To: patient.phone,
          From: twilioPhone,
          Url: webhookUrl,
          StatusCallback: `${appBaseUrl}/functions/v1/outreach-status-callback`,
          StatusCallbackEvent: 'completed',
          MachineDetection: 'Enable',
        });

        const twilioRes = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${btoa(`${twilioSid}:${twilioAuthToken}`)}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body,
          },
        );

        if (!twilioRes.ok) {
          const errText = await twilioRes.text();
          throw new Error(`Twilio API Error: ${errText}`);
        }

        const callData = await twilioRes.json();

        // 4. Update Status and Create Call Record
        const { data: callRecord, error: callError } = await supabase
          .from('ai_calls')
          .insert({
            clinic_id: job.clinic_id,
            patient_id: job.patient_id,
            phone_number: patient.phone,
            call_type: 'outreach',
            status: 'queued',
            external_call_id: callData.sid,
          })
          .select()
          .single();

        if (callError) throw callError;

        await supabase
          .from('outreach_jobs')
          .update({
            status: 'in_progress',
            last_attempt_at: new Date().toISOString(),
            attempt_count: job.attempt_count + 1,
            last_call_id: callRecord.id,
          })
          .eq('id', job.id);

        console.log(`Job ${job.id}: Call initiated (SID: ${callData.sid})`);
        results.push({ job_id: job.id, status: 'initiated', sid: callData.sid });
      } catch (err: any) {
        console.error(`Job ${job.id} failed:`, err);
        await markJobRetry(supabase, job.id, job.attempt_count + 1, err.message);
        results.push({ job_id: job.id, status: 'retry_scheduled', error: err.message });
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Batch processing complete',
        processed: jobs.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error in outreach-processor:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// Helpers
async function markJobFailed(supabase: any, jobId: string, reason: string) {
  await supabase
    .from('outreach_jobs')
    .update({
      status: 'failed',
      outcome_summary: reason,
    })
    .eq('id', jobId);
}

async function markJobRetry(supabase: any, jobId: string, newCount: number, reason: string) {
  // Retry logic: Add delay (e.g. 4 hours)
  const nextRetry = new Date();
  nextRetry.setHours(nextRetry.getHours() + 4);

  await supabase
    .from('outreach_jobs')
    .update({
      status: 'scheduled', // Back to scheduled queue
      attempt_count: newCount,
      outcome_summary: `Retry due to error: ${reason}`,
      scheduled_for: nextRetry.toISOString(),
    })
    .eq('id', jobId);
}
