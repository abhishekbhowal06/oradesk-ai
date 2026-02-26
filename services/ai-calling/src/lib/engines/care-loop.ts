import { supabase } from '../supabase';
import { logger } from '../logging/structured-logger';
import { twilioClient, TWILIO_PHONE_NUMBER } from '../twilio';
import { sendSMS } from '../twilio-sms';

export type CampaignType = 'confirmation' | 'recall' | 'no_show' | 'default';

interface FollowUpItem {
    id: string;
    clinic_id: string;
    patient_id: string;
    appointment_id?: string;
    campaign_type: CampaignType;
    attempt_number: number;
    max_attempts: number;
    last_attempt_at?: string;
    next_attempt_at: string;
    status: 'pending' | 'completed' | 'exhausted' | 'cancelled';
    metadata: any;
    patients?: { phone: string; first_name: string };
    clinics?: { name: string; ai_settings: any };
}

export class CareLoopEngine {
    private readonly BATCH_SIZE = 50;

    /**
     * Main processor run by cron
     */
    async processDueLoops() {
        logger.info('🔄 CareLoop processing started');

        try {
            const now = new Date().toISOString();

            // Fetch pending items due for action
            const { data: items, error } = await supabase
                .from('follow_up_schedules')
                .select(`
          *,
          patients (phone, first_name),
          clinics (name, ai_settings)
        `)
                .eq('status', 'pending')
                .lte('next_attempt_at', now)
                .limit(this.BATCH_SIZE);

            if (error) throw error;

            if (!items || items.length === 0) {
                logger.info('No due CareLoop items found');
                return;
            }

            logger.info(`Found ${items.length} CareLoop items to process`);

            // Process in parallel chunks to avoid rate limits but improve speed
            const CHUNK_SIZE = 10;
            for (let i = 0; i < items.length; i += CHUNK_SIZE) {
                const chunk = items.slice(i, i + CHUNK_SIZE);
                await Promise.all(chunk.map(item => this.processItem(item as any)));
            }

        } catch (err) {
            logger.error('CareLoop processing error', { error: err });
        }
    }

    /**
     * Process a single follow-up item
     */
    private async processItem(item: FollowUpItem) {
        try {
            // 1. Check Max Attempts
            if (item.attempt_number >= item.max_attempts) {
                await this.updateStatus(item.id, 'exhausted');
                return;
            }

            // 2. Determine Strategy
            const strategy = this.getStrategy(item.campaign_type || 'default');
            const action = strategy[item.attempt_number] || strategy[strategy.length - 1]; // Fallback to last step

            if (!action) {
                logger.warn('No action defined for step', { attempt: item.attempt_number });
                await this.updateStatus(item.id, 'exhausted');
                return;
            }

            logger.info(`Executing CareLoop Action: ${action.type}`, {
                id: item.id,
                campaign: item.campaign_type,
                attempt: item.attempt_number
            });

            // 3. Execute Action
            let success = false;
            if (action.type === 'call') {
                success = await this.executeCall(item, action.scriptId);
            } else if (action.type === 'sms') {
                success = await this.executeSMS(item, action.templateId);
            } else if (action.type === 'wait') {
                success = true; // Just a delay step
            }

            // 4. Update State (Increment attempt, set next time)
            if (success) {
                const nextTime = new Date(Date.now() + (action.delayHours || 24) * 3600000).toISOString();
                await supabase
                    .from('follow_up_schedules')
                    .update({
                        attempt_number: item.attempt_number + 1,
                        last_attempt_at: new Date().toISOString(),
                        next_attempt_at: nextTime,
                    })
                    .eq('id', item.id);
            } else {
                // Retry logic managed by next run? Or separate retry state?
                // For now, simple retry in 1 hour
                const retryTime = new Date(Date.now() + 1 * 3600000).toISOString();
                await supabase
                    .from('follow_up_schedules')
                    .update({ next_attempt_at: retryTime }) // Don't increment attempt on failure (system error)
                    .eq('id', item.id);
            }

        } catch (err) {
            logger.error('Failed to process CareLoop item', { id: item.id, error: err });
        }
    }

    /**
     * Define strategies for different campaigns
     */
    private getStrategy(type: string): Array<{ type: 'call' | 'sms' | 'wait', delayHours: number, scriptId?: string, templateId?: string }> {
        switch (type) {
            case 'confirmation':
                return [
                    { type: 'sms', delayHours: 24, templateId: 'confirm_sms_1' }, // Day 1: SMS
                    { type: 'call', delayHours: 24, scriptId: 'confirm_call_1' }, // Day 2: Call
                    { type: 'sms', delayHours: 0, templateId: 'confirm_sms_final' } // Day 3: Final SMS
                ];
            case 'recall':
                return [
                    { type: 'sms', delayHours: 48, templateId: 'recall_sms_1' },
                    { type: 'call', delayHours: 72, scriptId: 'recall_call_1' }
                ];
            case 'no_show': // Agressive checks
                return [
                    { type: 'call', delayHours: 1, scriptId: 'no_show_immediate' },
                    { type: 'sms', delayHours: 24, templateId: 'no_show_followup' }
                ];
            default: // Legacy behavior (Calls only)
                return [
                    { type: 'call', delayHours: 24 },
                    { type: 'call', delayHours: 24 },
                    { type: 'call', delayHours: 24 }
                ];
        }
    }

    /**
     * Schedule a confirmation loop for a new appointment
     */
    async scheduleConfirmation(
        clinicId: string,
        patientId: string,
        appointmentId: string,
        appointmentTime: string
    ): Promise<void> {
        const apptDate = new Date(appointmentTime);
        // T - 48 hours
        const triggerTime = new Date(apptDate.getTime() - 48 * 60 * 60 * 1000);
        const now = new Date();

        // If appointment is sooner than 48h, schedule for "now" (or +1 hour)
        let nextAttempt = triggerTime;
        if (triggerTime < now) {
            nextAttempt = new Date(now.getTime() + 10 * 60000); // 10 mins from now
        }

        await supabase.from('follow_up_schedules').insert({
            clinic_id: clinicId,
            patient_id: patientId,
            appointment_id: appointmentId,
            campaign_type: 'confirmation',
            attempt_number: 0,
            max_attempts: 3,
            status: 'pending',
            next_attempt_at: nextAttempt.toISOString(),
            metadata: { appointment_time: appointmentTime }
        });

        logger.info('Scheduled confirmation loop', { appointmentId, triggerTime: nextAttempt });
    }

    private async executeCall(item: FollowUpItem, scriptId?: string): Promise<boolean> {
        if (!item.patients?.phone) return false;

        // Create Call Record
        const { data: newCall } = await supabase
            .from('ai_calls')
            .insert({
                clinic_id: item.clinic_id,
                appointment_id: item.appointment_id,
                patient_id: item.patient_id,
                phone_number: item.patients.phone,
                call_type: 'follow_up', // Could be more specific based on campaign
                status: 'queued',
            })
            .select()
            .single();

        if (!newCall) return false;

        // Trigger Twilio
        const webhookUrl = `${process.env.SERVICE_URL}/v1/webhooks/twilio/voice?call_id=${newCall.id}&campaign=${item.campaign_type}`;
        await twilioClient.calls.create({
            to: item.patients.phone,
            from: TWILIO_PHONE_NUMBER!,
            url: webhookUrl,
            statusCallback: `${process.env.SERVICE_URL}/v1/webhooks/twilio/status?call_id=${newCall.id}`,
            statusCallbackEvent: ['completed', 'failed', 'busy', 'no-answer'],
        });

        return true;
    }

    private async executeSMS(item: FollowUpItem, templateId?: string): Promise<boolean> {
        if (!item.patients?.phone) return false;

        // Construct message based on template (Simple map for now)
        let body = `Hi ${item.patients.first_name}, this is ${item.clinics?.name}. Please contact us regarding your appointment.`;

        if (templateId?.includes('confirm')) {
            body = `Hi ${item.patients.first_name}, prompt confirmation: Do you still plan to attend your appointment at ${item.clinics?.name}? Reply YES or NO.`;
        }

        await sendSMS({
            to: item.patients.phone,
            body,
            trackEngagement: true
        });

        return true;
    }

    private async updateStatus(id: string, status: string) {
        await supabase.from('follow_up_schedules').update({ status }).eq('id', id);
    }
}

export const careLoopEngine = new CareLoopEngine();
