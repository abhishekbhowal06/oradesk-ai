/**
 * SMS HELPER
 * Send SMS messages via Twilio
 */

import twilio from 'twilio';
import { logger } from './logger';

const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);

interface SMSOptions {
    to: string;
    body: string;
    priority?: 'normal' | 'urgent';
    expectsReply?: boolean;
    appointmentId?: string;
    trackEngagement?: boolean;
}

export async function sendSMS(options: SMSOptions): Promise<void> {
    try {
        const message = await client.messages.create({
            to: options.to,
            from: process.env.TWILIO_PHONE_NUMBER!,
            body: options.body
        });

        logger.info('SMS sent', {
            to: options.to,
            sid: message.sid,
            priority: options.priority || 'normal'
        });

    } catch (error) {
        logger.error('Error sending SMS', { error, to: options.to });
        throw error;
    }
}
