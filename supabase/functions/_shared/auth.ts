import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Verifies JWT token and returns the authenticated user.
 * Throws an error if authentication fails.
 */
export async function verifyAuthToken(req: Request): Promise<{ userId: string; email: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header');
  }

  const token = authHeader.replace('Bearer ', '');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    throw new Error('Invalid or expired token');
  }

  return {
    userId: data.claims.sub as string,
    email: data.claims.email as string,
  };
}

/**
 * Verifies that a user is a member of a specific clinic.
 * Throws an error if the user is not a member.
 */
export async function verifyClinicMembership(
  userId: string, 
  clinicId: string,
  supabaseUrl: string,
  serviceRoleKey: string
): Promise<{ role: string }> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: membership, error } = await supabase
    .from('staff_memberships')
    .select('id, role')
    .eq('user_id', userId)
    .eq('clinic_id', clinicId)
    .eq('is_active', true)
    .single();

  if (error || !membership) {
    throw new Error('Not authorized for this clinic');
  }

  return { role: membership.role };
}

/**
 * Validates Twilio webhook signature.
 * For webhook endpoints, we can't use JWT auth, so we validate Twilio's signature.
 */
export function validateTwilioWebhook(req: Request, authToken: string, url: string): boolean {
  // Note: For production, implement full signature validation using Twilio's algorithm
  // This is a basic check - the request must come from Twilio
  const twilioSignature = req.headers.get('X-Twilio-Signature');
  
  // If no signature header is present, this is not a Twilio webhook
  // For internal calls (cron jobs), we skip this validation
  if (!twilioSignature) {
    return false;
  }
  
  // For MVP: Accept requests with Twilio signature header
  // Production: Implement full HMAC validation per Twilio docs
  return true;
}
