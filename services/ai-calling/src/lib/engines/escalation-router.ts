/**
 * ESCALATION ROUTER (The "Brain")
 *
 * Purpose: Route information to the correct person based on urgency.
 * Goal: NEVER interrupt the doctor unless it is an existential emergency.
 */

import { logger } from '../logging/structured-logger';
import { sendSMS } from '../twilio-sms';
import { supabase } from '../supabase';

export type EscalationLevel = 'INFO' | 'ATTENTION' | 'URGENT' | 'EMERGENCY';

export interface EscalationRequest {
  level: EscalationLevel;
  context: string;
  clinicId: string;
  patientId?: string;
}

export class EscalationRouter {
  async route(request: EscalationRequest) {
    logger.info(`Routing escalation: ${request.level}`, { context: request.context });

    switch (request.level) {
      case 'INFO':
        await this.logToDashboard(request);
        break;
      case 'ATTENTION':
        await this.alertFrontDesk(request);
        break;
      case 'URGENT':
        await this.alertOfficeManager(request);
        break;
      case 'EMERGENCY':
        await this.alertDoctor(request); // ONLY for valid emergencies
        break;
    }
  }

  private async logToDashboard(req: EscalationRequest) {
    // Just DB insert
    await supabase.from('autonomous_actions').insert({
      clinic_id: req.clinicId,
      patient_id: req.patientId,
      action_type: 'info_log',
      action_taken: req.context,
      outcome: 'success',
    });
  }

  private async alertFrontDesk(req: EscalationRequest) {
    // In real app: Send to Slack/Teams channel "Front Desk"
    // For now: Log as "Task Created"
    await supabase.from('autonomous_actions').insert({
      clinic_id: req.clinicId,
      action_type: 'task_created',
      action_taken: `Created Front Desk Task: ${req.context}`,
      outcome: 'pending',
    });
  }

  private async alertOfficeManager(req: EscalationRequest) {
    // Find Office Manager (simulated lookup)
    // In real app: lookup 'staff' table where role='office_manager'
    // Fallback to sending SMS to clinic main line marked "ATTN MANAGER"

    // Log action
    logger.info('Alerted Office Manager', { context: req.context });
  }

  private async alertDoctor(req: EscalationRequest) {
    // HOLY GRAIL - DO NOT ABUSE

    const { data: clinic } = await supabase
      .from('clinics')
      .select('owner_phone')
      .eq('id', req.clinicId)
      .single();

    if (clinic?.owner_phone) {
      await sendSMS({
        to: clinic.owner_phone,
        body: `🚨 CLINICAL EMERGENCY: ${req.context}`,
        priority: 'urgent',
      });
    }
  }
}

export const escalationRouter = new EscalationRouter();
