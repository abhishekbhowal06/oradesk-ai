import { Resend } from 'resend';
import { logger } from '../lib/logging/structured-logger';

const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!RESEND_API_KEY) {
  logger.warn('Missing RESEND_API_KEY - Email features disabled');
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const FROM_EMAIL = 'Dentacor <system@dentacor.com>'; // Update with verified domain

export class EmailService {
  /**
   * Send a welcome email to a new clinic admin
   */
  static async sendWelcomeEmail(email: string, clinicName: string) {
    if (!resend) {
      logger.warn('Email service disabled, skipping welcome email', { email });
      return;
    }

    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: 'Welcome to Dentacor AI',
        html: `
                    <h1>Welcome to Dentacor, ${clinicName}!</h1>
                    <p>Your AI Receptionist is ready to be configured.</p>
                    <p><strong>Next Steps:</strong></p>
                    <ol>
                        <li>Complete your <a href="https://app.dentacor.com/setup">Setup Guide</a></li>
                        <li>Verify your phone number</li>
                        <li>Test your first call</li>
                    </ol>
                    <p>Need help? Reply to this email.</p>
                `,
      });
      logger.info('Welcome email sent', { email });
    } catch (error) {
      logger.error('Failed to send welcome email', error);
    }
  }

  /**
   * Send a password reset link
   */
  static async sendPasswordReset(email: string, resetToken: string) {
    if (!resend) {
      logger.warn('Email service disabled, skipping password reset', { email });
      return;
    }

    const resetLink = `https://app.dentacor.com/reset-password?token=${resetToken}`;

    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: 'Reset your Dentacor password',
        html: `
                    <p>You requested a password reset.</p>
                    <p><a href="${resetLink}">Click here to reset your password</a></p>
                    <p>If you didn't request this, ignore this email.</p>
                `,
      });
      logger.info('Password reset email sent', { email });
    } catch (error) {
      logger.error('Failed to send password reset email', error);
    }
  }

  /**
   * Send an alert about payment failure/account downgrade
   */
  static async sendPaymentFailedAlert(email: string, clinicName: string) {
    if (!resend) {
      logger.warn('Email service disabled, skipping payment alert', { email });
      return;
    }

    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: 'Action Required: Payment Failed',
        html: `
                    <h1>Payment Failed for ${clinicName}</h1>
                    <p>We were unable to process your latest payment.</p>
                    <p><strong>Your account has been temporarily downgraded to the Free tier.</strong></p>
                    <p>To restore Pro features (Unlimited Calls, AI Scheduling), please update your payment method:</p>
                    <p><a href="https://app.dentacor.com/settings/billing">Update Payment Method</a></p>
                `,
      });
      logger.info('Payment failure alert sent', { email });
    } catch (error) {
      logger.error('Failed to send payment failure alert', error);
    }
  }
  /**
   * Send an invite to a staff member
   */
  static async sendInvite(email: string, inviteLink: string, role: string) {
    if (!resend) {
      logger.warn('Email service disabled, skipping invite', { email });
      return;
    }

    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject: 'You have been invited to Dentacor',
        html: `
                    <p>You have been invited to join Dentacor as a <strong>${role}</strong>.</p>
                    <p><a href="${inviteLink}">Click here to accept your invitation</a></p>
                    <p>If you didn't expect this, ignore this email.</p>
                `,
      });
      logger.info('Invite email sent', { email });
    } catch (error) {
      logger.error('Failed to send invite email', error);
    }
  }
}
