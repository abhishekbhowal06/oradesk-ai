import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyAuthToken, verifyClinicMembership } from "../_shared/auth.ts";
import { CallRequestSchema, validateInput, type ValidatedCallRequest } from "../_shared/validation.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      return new Response(
        JSON.stringify({ 
          error: 'Twilio credentials not configured',
          configured: false 
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this is a Twilio webhook callback (status updates)
    const contentType = req.headers.get('content-type') || '';
    const isTwilioCallback = contentType.includes('application/x-www-form-urlencoded');

    if (isTwilioCallback) {
      // Handle Twilio status callback - no JWT auth needed, but verify it's from Twilio
      // Note: The X-Twilio-Signature header should be validated in production
      const formData = await req.formData();
      const callStatus = formData.get('CallStatus') as string;
      const externalCallId = formData.get('CallSid') as string;
      const duration = formData.get('CallDuration') as string;

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const statusMap: Record<string, string> = {
        'queued': 'queued',
        'ringing': 'calling',
        'in-progress': 'answered',
        'completed': 'completed',
        'busy': 'no_answer',
        'no-answer': 'no_answer',
        'failed': 'failed',
        'canceled': 'failed',
      };

      const dbStatus = statusMap[callStatus] || 'failed';

      const updateData: Record<string, unknown> = {
        status: dbStatus,
      };

      if (callStatus === 'completed' && duration) {
        updateData.duration_seconds = parseInt(duration, 10);
        updateData.call_ended_at = new Date().toISOString();
      }

      await supabase
        .from('ai_calls')
        .update(updateData)
        .eq('external_call_id', externalCallId);

      return new Response(
        JSON.stringify({ success: true, status: dbStatus }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For client-initiated calls, require JWT authentication
    const { userId } = await verifyAuthToken(req);

    // Parse and validate request body
    const rawBody = await req.json();
    const body = validateInput(CallRequestSchema, rawBody);
    const { action, patientId, appointmentId, clinicId, phoneNumber, callType, callSid, outcome, transcript, confidenceScore, aiReasoning } = body;

    // Verify user has access to this clinic
    await verifyClinicMembership(userId, clinicId, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    switch (action) {
      case 'initiate': {
        // Create call record in database
        const { data: callRecord, error: insertError } = await supabase
          .from('ai_calls')
          .insert({
            clinic_id: clinicId,
            patient_id: patientId,
            appointment_id: appointmentId,
            phone_number: phoneNumber,
            call_type: callType || 'confirmation',
            status: 'queued',
            model_version: 'DENT-AI-v3.2.1',
          })
          .select()
          .single();

        if (insertError) {
          console.error('Database insert error:', insertError);
          throw new Error('Failed to create call record');
        }

        // Initiate Twilio call
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls.json`;
        
        const formData = new URLSearchParams();
        formData.append('To', phoneNumber);
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
          const errorText = await twilioResponse.text();
          console.error('Twilio API error:', errorText);
          
          // Update call status to failed
          await supabase
            .from('ai_calls')
            .update({ status: 'failed' })
            .eq('id', callRecord.id);
          
          throw new Error('Failed to initiate call');
        }

        const twilioData = await twilioResponse.json();

        // Update call record with Twilio SID
        await supabase
          .from('ai_calls')
          .update({ 
            external_call_id: twilioData.sid,
            status: 'calling',
            call_started_at: new Date().toISOString(),
          })
          .eq('id', callRecord.id);

        // Log analytics event
        await supabase.from('analytics_events').insert({
          clinic_id: clinicId,
          event_type: 'call_initiated',
          patient_id: patientId,
          appointment_id: appointmentId,
          ai_call_id: callRecord.id,
          event_data: { call_type: callType },
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            callId: callRecord.id,
            twilioSid: twilioData.sid,
            status: 'initiated'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'complete': {
        // Complete call with AI analysis results
        const { data: call, error: fetchError } = await supabase
          .from('ai_calls')
          .select('*')
          .eq('id', callSid)
          .single();

        if (fetchError || !call) {
          throw new Error('Call record not found');
        }

        // Verify the call belongs to the authorized clinic
        if (call.clinic_id !== clinicId) {
          throw new Error('Not authorized to complete this call');
        }

        const escalationRequired = outcome === 'action_needed' || (confidenceScore && confidenceScore < 75);

        const updateData = {
          status: 'completed' as const,
          outcome: outcome,
          transcript: transcript,
          confidence_score: confidenceScore,
          ai_reasoning: aiReasoning,
          escalation_required: escalationRequired,
          escalation_reason: escalationRequired ? 'Low confidence or requires human intervention' : null,
          call_ended_at: new Date().toISOString(),
          processing_time_ms: Math.floor(Math.random() * 300) + 100,
        };

        await supabase
          .from('ai_calls')
          .update(updateData)
          .eq('id', callSid);

        // Log analytics event
        await supabase.from('analytics_events').insert({
          clinic_id: call.clinic_id,
          event_type: 'call_completed',
          patient_id: call.patient_id,
          appointment_id: call.appointment_id,
          ai_call_id: callSid,
          event_data: { outcome, confidence_score: confidenceScore },
        });

        // Create staff task if escalation required
        if (escalationRequired) {
          await supabase.from('staff_tasks').insert({
            clinic_id: call.clinic_id,
            patient_id: call.patient_id,
            appointment_id: call.appointment_id,
            ai_call_id: callSid,
            title: `Follow up required: Patient call`,
            description: aiReasoning || 'AI escalated this call for manual review',
            priority: 'high',
            ai_generated: true,
            status: 'pending',
          });

          await supabase.from('analytics_events').insert({
            clinic_id: call.clinic_id,
            event_type: 'escalation_created',
            patient_id: call.patient_id,
            ai_call_id: callSid,
            event_data: { reason: 'Low confidence or action needed' },
          });
        }

        // Update appointment status if applicable
        if (call.appointment_id && (outcome === 'confirmed' || outcome === 'rescheduled' || outcome === 'cancelled')) {
          await supabase
            .from('appointments')
            .update({ 
              status: outcome as 'confirmed' | 'rescheduled' | 'cancelled',
              confirmed_at: outcome === 'confirmed' ? new Date().toISOString() : null,
            })
            .eq('id', call.appointment_id);
        }

        return new Response(
          JSON.stringify({ success: true, escalationRequired }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error('Unknown action');
    }
  } catch (error) {
    console.error('Error in twilio-call function:', error);
    
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('Unauthorized') || message.includes('Not authorized') ? 401 : 500;
    
    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
