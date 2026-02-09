import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function is designed to be called by a cron job, not by clients directly.
// It uses a secret token for authentication instead of JWT.
const CRON_SECRET = Deno.env.get('CRON_SECRET');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify this is an authorized cron call
    // Accept calls without auth header only in development or when CRON_SECRET is not set
    const authHeader = req.headers.get('Authorization');
    if (CRON_SECRET) {
      if (!authHeader || authHeader !== `Bearer ${CRON_SECRET}`) {
        console.error('Unauthorized cron call attempt');
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date().toISOString();

    // Find pending follow-ups that are due
    const { data: pendingFollowups, error: fetchError } = await supabase
      .from('follow_up_schedules')
      .select(`
        *,
        patient:patients (
          id,
          first_name,
          last_name,
          phone
        ),
        appointment:appointments (
          id,
          scheduled_at,
          procedure_name
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(10);

    if (fetchError) {
      throw new Error(`Failed to fetch follow-ups: ${fetchError.message}`);
    }

    const results = {
      processed: 0,
      called: 0,
      exhausted: 0,
      errors: [] as string[],
    };

    for (const followup of pendingFollowups || []) {
      try {
        // Validate patient phone before proceeding
        const patientPhone = followup.patient?.phone;
        if (!patientPhone || !/^\+?[1-9]\d{1,14}$/.test(patientPhone)) {
          results.errors.push(`Skipping ${followup.id}: Invalid patient phone number`);
          continue;
        }

        // Check if max attempts reached
        if (followup.attempt_number >= followup.max_attempts) {
          // Mark as exhausted and create staff task
          await supabase
            .from('follow_up_schedules')
            .update({
              status: 'exhausted',
              failure_reason: 'Maximum attempts reached',
              updated_at: now,
            })
            .eq('id', followup.id);

          // Create escalation task
          await supabase.from('staff_tasks').insert({
            clinic_id: followup.clinic_id,
            patient_id: followup.patient_id,
            appointment_id: followup.appointment_id,
            title: `Follow-up exhausted: ${followup.patient?.first_name} ${followup.patient?.last_name}`,
            description: `AI was unable to reach patient after ${followup.max_attempts} attempts. Manual follow-up required.`,
            priority: 'high',
            ai_generated: true,
            status: 'pending',
          });

          await supabase.from('analytics_events').insert({
            clinic_id: followup.clinic_id,
            event_type: 'escalation_created',
            patient_id: followup.patient_id,
            appointment_id: followup.appointment_id,
            event_data: { reason: 'follow_up_exhausted', attempts: followup.max_attempts },
          });

          results.exhausted++;
          results.processed++;
          continue;
        }

        // Check if Twilio is configured
        if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
          results.errors.push(`Skipping ${followup.id}: Twilio not configured`);
          continue;
        }

        // Update to in_progress
        await supabase
          .from('follow_up_schedules')
          .update({
            status: 'in_progress',
            last_attempt_at: now,
            attempt_number: followup.attempt_number + 1,
            updated_at: now,
          })
          .eq('id', followup.id);

        // Create call record
        const { data: callRecord, error: callError } = await supabase
          .from('ai_calls')
          .insert({
            clinic_id: followup.clinic_id,
            patient_id: followup.patient_id,
            appointment_id: followup.appointment_id,
            phone_number: patientPhone,
            call_type: 'follow_up',
            status: 'queued',
            model_version: 'DENT-AI-v3.2.1',
          })
          .select()
          .single();

        if (callError) {
          throw new Error(`Failed to create call record: ${callError.message}`);
        }

        // Initiate Twilio call
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;
        
        const formData = new URLSearchParams();
        formData.append('To', patientPhone);
        formData.append('From', TWILIO_PHONE_NUMBER);
        formData.append('Url', `${SUPABASE_URL}/functions/v1/twilio-twiml?callId=${callRecord.id}`);
        formData.append('StatusCallback', `${SUPABASE_URL}/functions/v1/twilio-call`);
        formData.append('StatusCallbackEvent', 'initiated ringing answered completed');
        formData.append('StatusCallbackMethod', 'POST');

        const twilioResponse = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData,
        });

        if (!twilioResponse.ok) {
          console.error('Twilio API error');
          
          // Update call as failed and schedule retry
          await supabase
            .from('ai_calls')
            .update({ status: 'failed' })
            .eq('id', callRecord.id);

          const nextAttempt = new Date();
          nextAttempt.setHours(nextAttempt.getHours() + followup.delay_hours);

          await supabase
            .from('follow_up_schedules')
            .update({
              status: 'pending',
              next_attempt_at: nextAttempt.toISOString(),
              scheduled_for: nextAttempt.toISOString(),
              failure_reason: 'Call initiation failed',
              updated_at: now,
            })
            .eq('id', followup.id);

          results.errors.push(`Call failed for ${followup.id}`);
          continue;
        }

        const twilioData = await twilioResponse.json();

        // Update call record with Twilio SID
        await supabase
          .from('ai_calls')
          .update({
            external_call_id: twilioData.sid,
            status: 'calling',
            call_started_at: now,
          })
          .eq('id', callRecord.id);

        // Update follow-up with related call
        await supabase
          .from('follow_up_schedules')
          .update({
            related_call_id: callRecord.id,
            updated_at: now,
          })
          .eq('id', followup.id);

        // Log analytics event
        await supabase.from('analytics_events').insert({
          clinic_id: followup.clinic_id,
          event_type: 'call_initiated',
          patient_id: followup.patient_id,
          appointment_id: followup.appointment_id,
          ai_call_id: callRecord.id,
          event_data: { 
            call_type: 'follow_up', 
            attempt_number: followup.attempt_number + 1,
          },
        });

        results.called++;
        results.processed++;
      } catch (err) {
        results.errors.push(`Error processing ${followup.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: now,
        ...results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in process-followups:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
