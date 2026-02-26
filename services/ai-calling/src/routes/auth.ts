import { Router } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../lib/logging/structured-logger';
import { EmailService } from '../services/email-service';
import { logAdminAction } from '../lib/audit';
import { ProvisioningService } from '../lib/provisioning-service';

const router = Router();

// POST /v1/auth/signup - Create User + Clinic + Send Welcome
// JUSTIFICATION: This endpoint REQUIRES service_role to create auth users.
// This is an admin-only operation (user creation) — service_role is correct here.
router.post('/signup', async (req, res) => {
  const { email, password, full_name, clinic_name } = req.body;

  if (!email || !password || !full_name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // 1. Create Supabase Auth User (Admin context — requires service_role)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name },
      email_confirm: true,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    const userId = authData.user.id;

    // 2. Create Clinic (service_role needed — no RLS context for new user yet)
    const { data: clinic, error: clinicError } = await supabaseAdmin
      .from('clinics')
      .insert({
        name: clinic_name || `${full_name}'s Practice`,
        email,
        subscription_tier: 'starter',
        subscription_status: 'trialing',
      })
      .select()
      .single();

    if (clinicError) {
      logger.error('Clinic creation failed after auth signup', clinicError);
      // Rollback: delete the auth user we just created
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return res.status(500).json({ error: 'Failed to create clinic', details: clinicError });
    }

    // 3. Create membership linking user to clinic
    const { error: membershipError } = await supabaseAdmin
      .from('staff_memberships')
      .insert({
        user_id: userId,
        clinic_id: clinic.id,
        role: 'admin',
      });

    if (membershipError) {
      logger.error('Membership creation failed', membershipError);
    }

    // 4. Provision Clinic (Settings, Demo Data, Flags)
    await ProvisioningService.provisionClinic(clinic.id);

    // 5. Send Welcome Email
    await EmailService.sendWelcomeEmail(email, clinic.name);

    // 6. Audit Log (Self-registration)
    await logAdminAction({
      clinicId: clinic.id,
      actorId: userId,
      action: 'user.signup',
      resource: 'clinic',
      metadata: { email, role: 'admin' },
      ipAddress: req.ip
    });

    logger.info('User signed up successfully and clinic provisioned', { userId, clinicId: clinic.id });

    res.json({ user: authData.user, clinic });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Signup failed', { error: message });
    res.status(500).json({ error: message });
  }
});

// POST /v1/auth/invite - Invite Staff Member
// JUSTIFICATION: service_role required for admin.inviteUserByEmail / generateLink
router.post('/invite', async (req, res) => {
  const { email, role = 'staff' } = req.body;
  const adminClinicId = req.clinicId; // From middleware

  if (!adminClinicId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Use generateInviteLink for full control
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { data: { clinic_id: adminClinicId, role } },
    });

    if (linkError) throw linkError;

    await EmailService.sendInvite(email, linkData.properties.action_link, role);

    await logAdminAction({
      clinicId: adminClinicId,
      actorId: req.user?.sub || 'system',
      action: 'user.invite',
      resource: 'staff_memberships',
      metadata: { invitedEmail: email, role },
      ipAddress: req.ip
    });

    logger.info('Staff invitation sent', { email, clinicId: adminClinicId });
    res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Invite failed', { error: message });
    res.status(500).json({ error: message });
  }
});

// POST /v1/auth/forgot-password - Trigger Password Reset
// JUSTIFICATION: service_role required for admin.generateLink with recovery
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;

  try {
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    if (error) throw error;

    await EmailService.sendPasswordReset(email, data.properties.action_link);

    logger.info('Password reset requested', { email });
    res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Password reset failed', { error: message });
    res.status(500).json({ error: message });
  }
});

export default router;
