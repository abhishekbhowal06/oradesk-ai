import { Router } from 'express';
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse';
import { supabase } from '../lib/supabase';
import { analyzeIntent } from '../lib/gemini';
import { logger } from '../lib/logger';
import {
    AI_DISCLOSURE_SCRIPT,
    EMERGENCY_ESCALATION_SCRIPT,
    checkEmergency
} from '../lib/safety-boundaries';

const router = Router();

// Clinic phone number for escalation (should be configurable per clinic)
const ESCALATION_PHONE = process.env.CLINIC_ESCALATION_PHONE || '';

/**
 * Generate TwiML for human escalation
 */
function generateEscalationTwiML(reason: string): VoiceResponse {
    const twiml = new VoiceResponse();
    twiml.say(EMERGENCY_ESCALATION_SCRIPT);

    if (ESCALATION_PHONE) {
        // Dial the clinic directly
        twiml.dial(ESCALATION_PHONE);
    } else {
        twiml.say("A staff member will call you back shortly. Goodbye.");
        twiml.hangup();
    }

    return twiml;
}

// /v1/webhooks/twilio/voice
// Initial Call Handler - STREAMING MODE
router.post('/twilio/voice', async (req, res) => {
    const callId = req.query.call_id as string;
    const callType = req.query.type as string;
    const twiml = new VoiceResponse();

    if (!callId) {
        twiml.say("System error. Call ID missing.");
        twiml.hangup();
        res.type('text/xml');
        return res.send(twiml.toString());
    }

    // Retrieve call context
    const { data: call } = await supabase
        .from('ai_calls')
        .select('*, appointments(*), patients(first_name)')
        .eq('id', callId)
        .single();

    // MANDATORY: AI Disclosure at call start
    twiml.say(AI_DISCLOSURE_SCRIPT);
    twiml.pause({ length: 1 });

    const patientName = call?.patients?.first_name || "there";

    // Initial greeting (synchronous for clarity)
    if (callType === 'confirmation') {
        twiml.say(`Now, ${patientName}, we are calling to confirm your appointment on ${new Date(call?.appointments?.scheduled_at).toDateString()}. Are you still able to make it?`);
    } else if (callType === 'reminder') {
        twiml.say(`${patientName}, just a reminder for your dental appointment tomorrow. Can you confirm you'll be there?`);
    } else if (callType === 'recall') {
        twiml.say(`${patientName}, we noticed it's been a while since your last cleaning. Would you like to schedule a quick check-up?`);
    } else {
        twiml.say(`${patientName}, how can I help you with your appointment today?`);
    }

    // Start bidirectional audio stream
    const connect = twiml.connect();
    const stream = connect.stream({
        url: `wss://${process.env.SERVICE_URL?.replace('https://', '').replace('http://', '')}/v1/streams`,
        track: 'inbound_track'
    });

    // Pass call context via stream parameters
    stream.parameter({
        name: 'call_id',
        value: callId
    });
    stream.parameter({
        name: 'call_type',
        value: callType
    });

    res.type('text/xml');
    res.send(twiml.toString());
});

// /v1/webhooks/twilio/gather
// Handle Speech Input with EMERGENCY DETECTION
router.post('/twilio/gather', async (req, res) => {
    const callId = req.query.call_id as string;
    const callType = req.query.type as string || 'confirmation';
    const retryCount = req.query.retry ? parseInt(req.query.retry as string) : 0;
    const userInput = req.body.SpeechResult;
    const twiml = new VoiceResponse();

    if (!userInput) {
        if (retryCount >= 1) {
            twiml.say("I am having trouble hearing you. I will have a staff member call you back later. Goodbye.");
            twiml.hangup();
            if (callId) {
                await supabase.from('ai_calls').update({
                    outcome: 'unreachable',
                    escalation_required: true,
                    escalation_reason: 'Patient Silent / Audio Issues'
                }).eq('id', callId);
            }
        } else {
            twiml.say("I didn't catch that. Could you please repeat?");
            twiml.gather({
                input: ['speech'],
                timeout: 5,
                action: `${process.env.SERVICE_URL}/v1/webhooks/twilio/gather?call_id=${callId}&type=${callType}&retry=${retryCount + 1}`,
                method: 'POST'
            });
        }
        res.type('text/xml');
        return res.send(twiml.toString());
    }

    logger.info("Patient speech received", { callId, userInput });

    // SAFETY CHECK: Emergency phrase detection BEFORE AI processing
    const emergencyCheck = checkEmergency(userInput);

    if (!emergencyCheck.safe) {
        logger.warn("Emergency/escalation trigger detected", {
            callId,
            reason: emergencyCheck.reason,
            detectedPhrase: emergencyCheck.detectedPhrase,
            escalationType: emergencyCheck.escalationType
        });

        // Mark for immediate escalation
        await supabase.from('ai_calls').update({
            escalation_required: true,
            escalation_reason: `${emergencyCheck.escalationType}: ${emergencyCheck.detectedPhrase}`,
            transcript: { user: userInput, ai_response: EMERGENCY_ESCALATION_SCRIPT, intent: 'emergency' }
        }).eq('id', callId);

        // Generate escalation response
        const escalationTwiml = generateEscalationTwiML(emergencyCheck.reason || 'Emergency detected');
        res.type('text/xml');
        return res.send(escalationTwiml.toString());
    }

    // Get Context
    const { data: call } = await supabase
        .from('ai_calls')
        .select('*, appointments(*)')
        .eq('id', callId)
        .single();

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
                intent: analysis.intent
            },
            confidence_score: analysis.confidence,
            escalation_required: analysis.requires_human,
            escalation_reason: analysis.requires_human ? 'AI flagged for human review' : null
        })
        .eq('id', callId);

    // If AI flagged for human escalation
    if (analysis.requires_human) {
        logger.info("AI requested human escalation", { callId, intent: analysis.intent, confidence: analysis.confidence });

        twiml.say(analysis.response_text);
        twiml.say("I'll have a staff member call you back shortly to assist further. Thank you for your patience.");
        twiml.hangup();

        res.type('text/xml');
        return res.send(twiml.toString());
    }

    // LOGIC based on intent
    if (analysis.intent === 'confirm') {
        // Update appointment status
        if (call?.appointment_id) {
            await supabase.from('appointments').update({
                status: 'confirmed',
                confirmed_at: new Date().toISOString()
            }).eq('id', call.appointment_id);
        }
        await supabase.from('ai_calls').update({ outcome: 'confirmed' }).eq('id', callId);

        twiml.say(analysis.response_text);
        twiml.say("Thank you. We look forward to seeing you. Goodbye.");
        twiml.hangup();
    } else if (analysis.intent === 'reschedule') {
        await supabase.from('ai_calls').update({
            outcome: 'rescheduled',
            escalation_required: true,
            escalation_reason: 'Patient requested reschedule'
        }).eq('id', callId);

        twiml.say(analysis.response_text);
        twiml.say("I have noted your request. Our receptionist will call you back to find a better time. Goodbye.");
        twiml.hangup();
    } else if (analysis.intent === 'cancel') {
        await supabase.from('ai_calls').update({
            outcome: 'cancelled',
            escalation_required: true,
            escalation_reason: 'Patient requested cancellation'
        }).eq('id', callId);

        twiml.say(analysis.response_text);
        twiml.say("I have noted your cancellation request. A staff member may follow up. Goodbye.");
        twiml.hangup();
    } else {
        // Unknown intent - safe fallback
        twiml.say("I want to make sure I help you correctly. A staff member will call you back shortly. Goodbye.");
        twiml.hangup();
        await supabase.from('ai_calls').update({
            escalation_required: true,
            escalation_reason: 'Unclear intent - safe fallback'
        }).eq('id', callId);
    }

    res.type('text/xml');
    res.send(twiml.toString());
});

// /v1/webhooks/twilio/status
router.post('/twilio/status', async (req, res) => {
    const callId = req.query.call_id as string;
    const callStatus = req.body.CallStatus;
    const callDuration = req.body.CallDuration;

    if (callId) {
        const mapStatus = (s: string) => {
            if (s === 'completed') return 'completed';
            if (s === 'failed') return 'failed';
            if (s === 'busy' || s === 'no-answer') return 'no_answer';
            if (s === 'answered' || s === 'in-progress') return 'answered';
            return 'calling';
        };

        await supabase
            .from('ai_calls')
            .update({
                status: mapStatus(callStatus),
                duration_seconds: callDuration ? parseInt(callDuration) : null,
                call_ended_at: callStatus === 'completed' ? new Date().toISOString() : null
            })
            .eq('id', callId);
    }

    res.sendStatus(200);
});

// /v1/webhooks/twilio/stream-voice
// Connects call to WebSocket Stream (Phase 2 - Real-time voice)
router.post('/twilio/stream-voice', (req, res) => {
    const callId = req.query.call_id as string;
    const twiml = new VoiceResponse();

    // AI Disclosure first
    twiml.say(AI_DISCLOSURE_SCRIPT);

    // Replace http/https with wss
    const wssUrl = (process.env.SERVICE_URL || '').replace(/^http/, 'ws') + '/v1/streams';

    twiml.say("Connecting you to our assistant. Please hold.");
    const connect = twiml.connect();
    connect.stream({
        url: wssUrl,
        track: 'inbound_track'
    }).parameter({
        name: 'call_id',
        value: callId
    });

    res.type('text/xml');
    res.send(twiml.toString());
});

export default router;

