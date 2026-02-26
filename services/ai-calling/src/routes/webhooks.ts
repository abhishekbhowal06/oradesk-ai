import { Router } from 'express';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';
import { supabase } from '../lib/supabase';
import { analyzeIntent } from '../lib/gemini';
import { logger } from '../lib/logging/structured-logger';
import {
  AI_DISCLOSURE_SCRIPT,
  EMERGENCY_ESCALATION_SCRIPT,
  checkEmergency,
} from '../lib/safety-boundaries';
import { traceStorage } from '../lib/logging/context';
import { sendSMS } from '../lib/twilio-sms';
import { redisClient } from '../lib/redis';
import { checkAndLockWebhook } from '../lib/idempotency';

const router = Router();

/**
 * Generate TwiML for human escalation
 */
function generateEscalationTwiML(reason: string, escalationPhone?: string): VoiceResponse {
  const twiml = new VoiceResponse();
  twiml.say(EMERGENCY_ESCALATION_SCRIPT);

  if (escalationPhone) {
    // Dial the clinic directly
    twiml.dial(escalationPhone);
  } else {
    twiml.say('A staff member will call you back shortly. Goodbye.');
    twiml.hangup();
  }

  return twiml;
}

// /v1/webhooks/twilio/voice
// Initial Call Handler - STREAMING MODE
router.post('/twilio/voice', async (req, res) => {
  const callId = req.query.call_id as string;
  const callType = req.query.type as string;

  // Inject into context
  const store = traceStorage.getStore();
  if (store) store.callId = callId;

  const twiml = new VoiceResponse();

  if (!callId) {
    twiml.say('System error. Call ID missing.');
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // Retrieve call context with clinic settings
  const { data: call } = await supabase
    .from('ai_calls')
    .select(
      '*, appointments(*), patients(first_name), clinics(escalation_phone, ai_disclosure_enabled)',
    )
    .eq('id', callId)
    .single();

  // MANDATORY: AI Disclosure at call start (if enabled)
  // Default to true if setting is missing for safety
  const clinicsData = call?.clinics;
  const clinicSettings = Array.isArray(clinicsData) ? clinicsData[0] : clinicsData;
  const showDisclosure = clinicSettings?.ai_disclosure_enabled ?? true;

  if (showDisclosure) {
    twiml.say(AI_DISCLOSURE_SCRIPT);
    twiml.pause({ length: 1 });
  }

  const patientName = call?.patients?.first_name || 'there';

  // Initial greeting (synchronous for clarity)
  if (callType === 'confirmation') {
    twiml.say(
      `Now, ${patientName}, we are calling to confirm your appointment on ${new Date(call?.appointments?.scheduled_at).toDateString()}. Are you still able to make it?`,
    );
  } else if (callType === 'reminder') {
    twiml.say(
      `${patientName}, just a reminder for your dental appointment tomorrow. Can you confirm you'll be there?`,
    );
  } else if (callType === 'recall') {
    twiml.say(
      `${patientName}, we noticed it's been a while since your last cleaning. Would you like to schedule a quick check-up?`,
    );
  } else {
    twiml.say(`${patientName}, how can I help you with your appointment today?`);
  }

  // Start bidirectional audio stream
  const connect = twiml.connect();
  const stream = connect.stream({
    url: `wss://${process.env.SERVICE_URL?.replace('https://', '').replace('http://', '')}/v1/streams`,
    track: 'inbound_track',
  });

  // Pass call context via stream parameters
  stream.parameter({
    name: 'call_id',
    value: callId,
  });
  stream.parameter({
    name: 'call_type',
    value: callType,
  });

  res.type('text/xml');
  res.send(twiml.toString());
});

// /v1/webhooks/twilio/gather
// Handle Speech Input with EMERGENCY DETECTION
router.post('/twilio/gather', async (req, res) => {
  const callId = req.query.call_id as string;
  const callType = (req.query.type as string) || 'confirmation';

  // Inject into context
  const store = traceStorage.getStore();
  if (store) store.callId = callId;

  const retryCount = req.query.retry ? parseInt(req.query.retry as string) : 0;
  const userInput = req.body.SpeechResult;
  const twiml = new VoiceResponse();

  if (!userInput) {
    if (retryCount >= 1) {
      twiml.say(
        'I am having trouble hearing you. I will have a staff member call you back later. Goodbye.',
      );
      twiml.hangup();
      if (callId) {
        await supabase
          .from('ai_calls')
          .update({
            outcome: 'unreachable',
            escalation_required: true,
            escalation_reason: 'Patient Silent / Audio Issues',
          })
          .eq('id', callId);

        // AUTO-RECOVERY: Send text if audio failed
        const { data: callData } = await supabase
          .from('ai_calls')
          .select('phone_number, clinics(name)')
          .eq('id', callId)
          .single();

        if (callData?.phone_number) {
          const clinicName = Array.isArray(callData.clinics)
            ? (callData.clinics[0] as any)?.name
            : (callData.clinics as any)?.name || 'the clinic';

          await sendSMS({
            to: callData.phone_number,
            body: `Hello, this is ${clinicName}. We were having trouble hearing you. Please reply to this text or call us back when you are free.`,
            priority: 'normal',
          }).catch((err) => logger.error('Failed to send auto-recovery SMS', { err }));
        }
      }
    } else {
      twiml.say("I didn't catch that. Could you please repeat?");
      twiml.gather({
        input: ['speech'],
        timeout: 5,
        action: `${process.env.SERVICE_URL}/v1/webhooks/twilio/gather?call_id=${callId}&type=${callType}&retry=${retryCount + 1}`,
        method: 'POST',
      });
    }
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  logger.info('Patient speech received', { callId, userInput });

  // Get Context & Clinic Settings
  const { data: call } = await supabase
    .from('ai_calls')
    .select('*, appointments(*), clinics(escalation_phone)')
    .eq('id', callId)
    .single();

  const clinicsData = call?.clinics;
  const clinicSettings = Array.isArray(clinicsData) ? clinicsData[0] : clinicsData;
  const escalationPhone = clinicSettings?.escalation_phone;

  // SAFETY CHECK: Emergency phrase detection BEFORE AI processing
  const emergencyCheck = checkEmergency(userInput);

  if (!emergencyCheck.safe) {
    logger.warn('Emergency/escalation trigger detected', {
      callId,
      reason: emergencyCheck.reason,
      detectedPhrase: emergencyCheck.detectedPhrase,
      escalationType: emergencyCheck.escalationType,
    });

    // Mark for immediate escalation
    await supabase
      .from('ai_calls')
      .update({
        escalation_required: true,
        escalation_reason: `${emergencyCheck.escalationType}: ${emergencyCheck.detectedPhrase}`,
        transcript: {
          user: userInput,
          ai_response: EMERGENCY_ESCALATION_SCRIPT,
          intent: 'emergency',
        },
      })
      .eq('id', callId);

    // Generate escalation response with dynamic phone
    const escalationTwiml = generateEscalationTwiML(
      emergencyCheck.reason || 'Emergency detected',
      escalationPhone,
    );
    res.type('text/xml');
    return res.send(escalationTwiml.toString());
  }

  const context = `Appointment ID: ${call?.appointment_id}. Date: ${call?.appointments?.scheduled_at}. Procedure: ${call?.appointments?.procedure_name || 'General checkup'}.`;

  // ASK GEMINI with safety-hardened prompt
  const analysis = await analyzeIntent(context, userInput, callType);

  // Store transcript with full analysis
  await supabase
    .from('ai_calls')
    .update({
      transcript: {
        user: userInput,
        ai_response: analysis.response_text,
        intent: analysis.intent,
      },
      confidence_score: analysis.confidence,
      escalation_required: analysis.requires_human,
      escalation_reason: analysis.requires_human ? 'AI flagged for human review' : null,
    })
    .eq('id', callId);

  // If AI flagged for human escalation
  if (analysis.requires_human) {
    logger.info('AI requested human escalation', {
      callId,
      intent: analysis.intent,
      confidence: analysis.confidence,
    });

    twiml.say(analysis.response_text);
    twiml.say(
      "I'll have a staff member call you back shortly to assist further. Thank you for your patience.",
    );
    twiml.hangup();

    res.type('text/xml');
    return res.send(twiml.toString());
  }

  // LOGIC based on intent
  if (analysis.intent === 'confirm') {
    // Update appointment status
    if (call?.appointment_id) {
      await supabase
        .from('appointments')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
        })
        .eq('id', call.appointment_id);
    }
    await supabase.from('ai_calls').update({ outcome: 'confirmed' }).eq('id', callId);

    twiml.say(analysis.response_text);
    twiml.say('Thank you. We look forward to seeing you. Goodbye.');
    twiml.hangup();
  } else if (analysis.intent === 'reschedule') {
    await supabase
      .from('ai_calls')
      .update({
        outcome: 'rescheduled',
        escalation_required: true,
        escalation_reason: 'Patient requested reschedule',
      })
      .eq('id', callId);

    twiml.say(analysis.response_text);
    twiml.say(
      'I have noted your request. Our receptionist will call you back to find a better time. Goodbye.',
    );
    twiml.hangup();
  } else if (analysis.intent === 'cancel') {
    await supabase
      .from('ai_calls')
      .update({
        outcome: 'cancelled',
        escalation_required: true,
        escalation_reason: 'Patient requested cancellation',
      })
      .eq('id', callId);

    twiml.say(analysis.response_text);
    twiml.say('I have noted your cancellation request. A staff member may follow up. Goodbye.');
    twiml.hangup();
  } else {
    // Unknown intent - safe fallback
    twiml.say(
      'I want to make sure I help you correctly. A staff member will call you back shortly. Goodbye.',
    );
    twiml.hangup();
    await supabase
      .from('ai_calls')
      .update({
        escalation_required: true,
        escalation_reason: 'Unclear intent - safe fallback',
      })
      .eq('id', callId);
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// /v1/webhooks/twilio/status
router.post('/twilio/status', async (req, res) => {
  const callId = req.query.call_id as string;

  // Inject into context
  const store = traceStorage.getStore();
  if (store) store.callId = callId;

  const callStatus = req.body.CallStatus;
  const callDuration = req.body.CallDuration;

  // Twilio doesn't send a unique event ID for status updates, so we synthesize one
  // using the CallSid (Twilio's unique call ID) and the Status it is reporting.
  const eventId = `twilio_${req.body.CallSid}_${callStatus}`;
  const isNew = await checkAndLockWebhook('twilio', eventId);
  if (!isNew) {
    res.status(200).send('duplicate_status_ignored');
    return;
  }

  if (callId) {
    const mapStatus = (s: string) => {
      if (s === 'completed') return 'completed';
      if (s === 'failed') return 'failed';
      if (s === 'busy' || s === 'no-answer') return 'no_answer';
      if (s === 'answered' || s === 'in-progress') return 'answered';
      return 'calling';
    };

    const finalStatus = mapStatus(callStatus);

    await supabase
      .from('ai_calls')
      .update({
        status: finalStatus,
        duration_seconds: callDuration ? parseInt(callDuration) : null,
        call_ended_at: callStatus === 'completed' ? new Date().toISOString() : null,
      })
      .eq('id', callId);

    // Free up Redis concurrency token for campaign calls
    if (['completed', 'failed', 'no_answer'].includes(finalStatus)) {
      const { data: callInfo } = await supabase.from('ai_calls').select('clinic_id').eq('id', callId).single();
      if (callInfo?.clinic_id) {
        await redisClient.decr(`campaign_rate_limit:${callInfo.clinic_id}`);
      }
    }

    // AUTO-RECOVERY: Send SMS on Failure/No-Answer
    if (finalStatus === 'failed' || finalStatus === 'no_answer') {
      const { data: callData } = await supabase
        .from('ai_calls')
        .select('phone_number, clinics(name)')
        .eq('id', callId)
        .single();

      if (callData?.phone_number) {
        // Safe access to joined clinic name
        const clinicsData = callData.clinics;
        const clinicName = Array.isArray(clinicsData)
          ? (clinicsData[0] as any)?.name
          : (clinicsData as any)?.name || 'the clinic';

        const msg =
          finalStatus === 'no_answer'
            ? `Hello, this is ${clinicName}. We tried to reach you regarding your appointment. Please call us back or reply here.`
            : `Hello, this is ${clinicName}. We had trouble connecting. Please call us back at your convenience.`;

        await sendSMS({
          to: callData.phone_number,
          body: msg,
          priority: 'normal',
        }).catch((err) => logger.error('Failed to send auto-recovery SMS', { err }));
      }
    }
  }

  res.sendStatus(200);
});

// /v1/webhooks/twilio/stream-voice
// Connects call to WebSocket Stream (Phase 2 - Real-time voice)
// Connects call to WebSocket Stream (Phase 2 - Real-time voice)
router.post('/twilio/stream-voice', async (req, res) => {
  const callId = req.query.call_id as string;
  const twiml = new VoiceResponse();

  // Join with clinics to get settings
  const { data: call } = await supabase
    .from('ai_calls')
    .select('clinics(ai_disclosure_enabled)')
    .eq('id', callId)
    .single();

  // Handle potential array or object for joined relation
  const clinicsData = call?.clinics;
  const clinicSettings = Array.isArray(clinicsData) ? clinicsData[0] : clinicsData;
  const showDisclosure = clinicSettings?.ai_disclosure_enabled ?? true;

  // AI Disclosure first
  if (showDisclosure) {
    twiml.say(AI_DISCLOSURE_SCRIPT);
  }

  // Replace http/https with wss
  const wssUrl = (process.env.SERVICE_URL || '').replace(/^http/, 'ws') + '/v1/streams';

  twiml.say('Connecting you to our assistant. Please hold.');
  const connect = twiml.connect();
  connect
    .stream({
      url: wssUrl,
      track: 'inbound_track',
    })
    .parameter({
      name: 'call_id',
      value: callId,
    });

  res.type('text/xml');
  res.send(twiml.toString());
});

export default router;
