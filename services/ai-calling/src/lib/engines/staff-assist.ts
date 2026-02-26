/**
 * STAFF ASSIST TOOLS (The "Perfect Excuse" Generator)
 *
 * Purpose: Empower staff with AI-drafted scripts for difficult conversations.
 * Goal: "Make the staff look like magicians."
 */

export class StaffAssistAI {
  /**
   * Generate a professional excuse/script for rescheduling a patient
   * (e.g., when doctor has an emergency)
   */
  generateRescheduleScript(
    patientName: string,
    reasonType: 'emergency' | 'running_late' | 'equipment_fail',
  ): string {
    const greeting = `Hi ${patientName.split(' ')[0]}, this is Sarah from Dr. Smith's office.`;

    switch (reasonType) {
      case 'emergency':
        return `${greeting} I'm so sorry to call last minute, but Dr. Smith has had a surgical emergency come in that needs immediate attention. He's terrible sorry to miss you. Can we move you to [Next Open Slot] or [Alternative Slot]? We'll apply a $50 credit to your account for the trouble.`;

      case 'running_late':
        return `${greeting} We're running about 20 minutes behind schedule today due to a complex case. We respect your time and wanted to let you know before you drove over. You're welcome to come now and relax in the lounge, or come 20 minutes later?`;

      case 'equipment_fail':
        return `${greeting} We're having a technical issue with one of our treatment rooms. To make sure you get the best care, we need to shuffle the schedule slightly. Would moving to [Time] work for you? Again, I apologize for the inconvenience.`;

      default:
        return `${greeting} We need to reschedule your appointment.`;
    }
  }

  /**
   * Generate a polite collection/payment reminder script
   */
  generatePaymentScript(patientName: string, amount: number, daysOverdue: number): string {
    if (daysOverdue < 30) {
      return `Hi ${patientName}, just a friendly courtesy reminder that there's a balance of $${amount} on your account from your last visit. We can take care of that quickly over the phone or online anytime. Hope you're doing well!`;
    } else {
      return `Hi ${patientName}, we noticed your balance of $${amount} is still pending. We want to make sure this doesn't accidentally go to collections/affect your credit. Can we set up a small payment plan today to clear this up?`;
    }
  }
}

export const staffAssistAI = new StaffAssistAI();
