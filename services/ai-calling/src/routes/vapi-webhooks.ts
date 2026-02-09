import { Router, Request, Response } from 'express';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

const router = Router();

// Vapi sends events here: call.started, call.ended, transcript, etc.
router.post('/vapi/events', async (req: Request, res: Response) => {
    const event = req.body;

    logger.info(`Vapi Event Received: ${event.type}`, { callId: event.call?.id });

    try {
        switch (event.type) {
            case 'call-started':
                // Update our internal record
                if (event.call?.id) {
                    await supabase.from('ai_calls')
                        .update({ status: 'answered', call_started_at: new Date().toISOString() })
                        .eq('external_call_id', event.call.id);
                }
                break;

            case 'call-ended':
                // Finalize record
                if (event.call?.id) {
                    const outcome = mapVapiOutcome(event.call.endedReason);
                    await supabase.from('ai_calls')
                        .update({
                            status: 'completed',
                            call_ended_at: new Date().toISOString(),
                            outcome: outcome,
                            duration_seconds: event.call.duration
                        })
                        .eq('external_call_id', event.call.id);
                }
                break;

            case 'transcript':
                // Store partial/final transcript
                if (event.call?.id && event.transcript) {
                    // Append to transcript JSONB
                    const { data: call } = await supabase.from('ai_calls')
                        .select('transcript')
                        .eq('external_call_id', event.call.id)
                        .single();

                    const existingTranscript = call?.transcript || [];
                    existingTranscript.push({
                        role: event.transcript.role,
                        text: event.transcript.text,
                        timestamp: new Date().toISOString()
                    });

                    await supabase.from('ai_calls')
                        .update({ transcript: existingTranscript })
                        .eq('external_call_id', event.call.id);
                }
                break;

            case 'function-call':
                // Handle tool/function calls from the AI (e.g., book_appointment)
                logger.info("Vapi function call", { function: event.functionCall });
                // TODO: Implement booking logic here
                break;

            default:
                logger.debug(`Unhandled Vapi event: ${event.type}`);
        }
    } catch (error) {
        logger.error("Vapi webhook processing error", error);
    }

    res.sendStatus(200);
});

function mapVapiOutcome(endedReason: string | undefined): string {
    switch (endedReason) {
        case 'customer-ended-call':
        case 'assistant-ended-call':
            return 'confirmed'; // Assume success if call ended normally
        case 'customer-did-not-answer':
        case 'voicemail':
            return 'unreachable';
        case 'assistant-error':
        case 'pipeline-error':
            return 'action_needed';
        default:
            return 'action_needed';
    }
}

export default router;
