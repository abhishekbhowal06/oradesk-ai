import { VapiClient } from '@vapi-ai/server-sdk';
import { logger } from './logging/structured-logger';
import dotenv from 'dotenv';
dotenv.config();

const VAPI_API_KEY = process.env.VAPI_API_KEY;

if (!VAPI_API_KEY) {
  logger.warn('Missing VAPI_API_KEY - Vapi calls will fail.');
}

const vapiClient = new VapiClient({ token: VAPI_API_KEY || '' });

export interface VapiCallOptions {
  assistantId: string;
  customerPhone: string;
  clinicPhone: string;
  metadata?: Record<string, string>;
}

export async function createVapiOutboundCall(
  options: VapiCallOptions,
): Promise<{ callId: string } | null> {
  if (!VAPI_API_KEY) {
    logger.error('Cannot create Vapi call: VAPI_API_KEY missing');
    return null;
  }

  try {
    const call: any = await vapiClient.calls.create({
      assistantId: options.assistantId,
      phoneNumberId: options.clinicPhone, // This should be the Vapi Phone Number ID
      customer: {
        number: options.customerPhone,
      },
      // Metadata for webhooks
      assistantOverrides: {
        metadata: options.metadata,
      },
    });

    logger.info(`Vapi call created: ${call.id}`);
    return { callId: call.id };
  } catch (error) {
    logger.error('Vapi call creation failed', error);
    return null;
  }
}

export { vapiClient };
