import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyAuthToken, verifyClinicMembership } from '../_shared/auth.ts';
import {
  NotificationRequestSchema,
  validateInput,
  sanitizeString,
  type ValidatedNotificationRequest,
} from '../_shared/validation.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    // Require JWT authentication
    const { userId } = await verifyAuthToken(req);

    // Parse and validate request body
    const rawBody = await req.json();
    const body = validateInput(NotificationRequestSchema, rawBody);
    const { clinicId, patientId, type, template, data } = body;

    // Verify user has access to this clinic
    await verifyClinicMembership(userId, clinicId, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get clinic notification settings
    const { data: clinic, error: clinicError } = await supabase
      .from('clinics')
      .select('notification_settings, name')
      .eq('id', clinicId)
      .single();

    if (clinicError || !clinic) {
      throw new Error('Clinic not found');
    }

    const settings = clinic.notification_settings as {
      email_enabled?: boolean;
      sms_enabled?: boolean;
    };

    // Check if notification type is enabled
    if (type === 'email' && !settings.email_enabled) {
      return new Response(
        JSON.stringify({ success: false, reason: 'Email notifications disabled for this clinic' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (type === 'sms' && !settings.sms_enabled) {
      return new Response(
        JSON.stringify({ success: false, reason: 'SMS notifications disabled for this clinic' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let result: { success: boolean; messageId?: string; error?: string };

    // Sanitize message content before sending
    const sanitizedMessage = sanitizeString(data.message);

    if (type === 'sms') {
      // Send SMS via Twilio
      if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
        throw new Error('Twilio credentials not configured');
      }

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

      const formData = new URLSearchParams();
      formData.append('To', data.to);
      formData.append('From', TWILIO_PHONE_NUMBER);
      formData.append('Body', sanitizedMessage);

      const response = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to send SMS');
      }

      const twilioData = await response.json();
      result = { success: true, messageId: twilioData.sid };
    } else {
      // Send Email via Resend
      if (!RESEND_API_KEY) {
        throw new Error('Resend API key not configured. Please add RESEND_API_KEY secret.');
      }

      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${sanitizeString(clinic.name)} <noreply@dentacor.com>`,
          to: [data.to],
          subject: data.subject
            ? sanitizeString(data.subject)
            : 'Notification from your dental clinic',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1a365d;">${sanitizeString(clinic.name)}</h2>
              <p>${sanitizedMessage}</p>
              ${data.appointmentDate ? `<p><strong>Date:</strong> ${sanitizeString(data.appointmentDate)}</p>` : ''}
              ${data.appointmentTime ? `<p><strong>Time:</strong> ${sanitizeString(data.appointmentTime)}</p>` : ''}
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="color: #718096; font-size: 12px;">
                This is an automated message from ${sanitizeString(clinic.name)}. Please do not reply to this email.
              </p>
            </div>
          `,
        }),
      });

      if (!emailResponse.ok) {
        throw new Error('Failed to send email');
      }

      const emailData = await emailResponse.json();
      result = { success: true, messageId: emailData.id };
    }

    // Log to analytics
    await supabase.from('analytics_events').insert({
      clinic_id: clinicId,
      event_type: 'staff_action',
      patient_id: patientId,
      event_data: {
        action: 'notification_sent',
        type,
        template,
        success: result.success,
        message_id: result.messageId,
      },
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error sending notification:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';
    const status =
      message.includes('Unauthorized') || message.includes('Not authorized') ? 401 : 500;

    return new Response(JSON.stringify({ success: false, error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
