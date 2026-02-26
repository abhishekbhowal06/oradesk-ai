import { twilioClient } from '../lib/twilio';
import { logger } from '../lib/logging/structured-logger';

// Default sender in Sandbox mode is usually 'whatsapp:+14155238886'
// In production, this should be the clinic's WhatsApp number
const WHATSAPP_FROM = process.env.WHATSAPP_FROM_NUMBER || 'whatsapp:+14155238886';

export class WhatsAppService {
    /**
     * Send a free-form WhatsApp message (Session Message).
     * ONLY works if the user has messaged YOU within the last 24 hours.
     */
    async sendMessage(to: string, body: string) {
        try {
            // Ensure 'whatsapp:' prefix
            const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

            const message = await twilioClient.messages.create({
                from: WHATSAPP_FROM,
                to: toNumber,
                body,
            });

            logger.info('WhatsApp message sent', { sid: message.sid, to: toNumber });
            return message;
        } catch (error) {
            logger.error('Failed to send WhatsApp message', { error, to });
            throw error;
        }
    }

    /**
     * Send an Appointment Confirmation template.
     * This mimics a pre-approved template structure.
     */
    async sendAppointmentConfirmation(
        to: string,
        details: {
            patientName: string;
            date: string;
            time: string;
            doctorName: string;
            clinicName: string;
        }
    ) {
        // Template:
        // "Hello {{1}}, your appointment with {{2}} at {{3}} on {{4}} at {{5}} is confirmed."
        // Since we don't have real templates provisioned, we'll send text
        // expecting this is a sandbox or active session.

        const body = `Hello ${details.patientName}, your appointment with ${details.doctorName} at ${details.clinicName} on ${details.date} at ${details.time} is CONFIRMED. Reply 'RESCHEDULE' if you need to change it.`;

        return this.sendMessage(to, body);
    }

    /**
     * Send a "Call Back" notification if the AI couldn't reach them or they requested it.
     */
    async sendCallBackNotification(to: string, clinicName: string) {
        const body = `Hello, this is ${clinicName}. We tried to reach you regarding your appointment. Please reply 'CALL' and our AI receptionist will call you back immediately.`;
        return this.sendMessage(to, body);
    }
}

export const whatsappService = new WhatsAppService();
