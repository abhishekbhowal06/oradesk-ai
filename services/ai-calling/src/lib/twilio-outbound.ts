/**
 * TWILIO OUTBOUND CALLS
 * Helper for making outbound AI calls
 */

import twilio from 'twilio';
import { supabase } from './supabase';
import { logger } from './logging/structured-logger';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

interface OutboundCallOptions {
  to: string;
  clinicId: string;
  callType: string;
  context: any;
}

export async function makeOutboundCall(options: OutboundCallOptions): Promise<{ outcome: string }> {
  try {
    // Create call record
    const { data: callRecord } = await supabase
      .from('ai_calls')
      .insert({
        clinic_id: options.clinicId,
        direction: 'outbound',
        to_number: options.to,
        status: 'initiated',
        call_type: options.callType,
        context: options.context,
      })
      .select()
      .single();

    // Make Twilio call
    const { twilioCircuitBreaker } = require('./circuit-breaker');
    const call = await twilioCircuitBreaker.execute(async () => {
      return await client.calls.create({
        to: options.to,
        from: process.env.TWILIO_PHONE_NUMBER!,
        url: `${process.env.SERVICE_URL}/v1/webhooks/twilio/voice?callType=${options.callType}&context=${encodeURIComponent(JSON.stringify(options.context))}`,
      });
    });

    // Update record with Twilio SID
    await supabase.from('ai_calls').update({ twilio_call_sid: call.sid }).eq('id', callRecord!.id);


    logger.info('Outbound call initiated', {
      to: options.to,
      callType: options.callType,
      sid: call.sid,
    });

    // Simulate outcome for now (would be updated via webhook in real system)
    return { outcome: 'initiated' };
  } catch (error) {
    logger.error('Error making outbound call', { error, options });
    return { outcome: 'failed' };
  }
}
