# Key Rotation Runbook

## Purpose
This runbook details the procedures for rotating critical infrastructure keys, API tokens, and secrets in the OraDesk AI environment. Regular rotation mitigates the risk of credential compromise.

## Schedule
| Secret Type | Rotation Frequency | Authority |
|---|---|---|
| Supabase Database Password | Every 90 Days | DevSecOps Lead |
| Twilio Auth Token | Every 180 Days | Platform Eng |
| Google Gemini API Keys | Every 90 Days | Platform Eng |
| Vapi API Keys | Every 180 Days | Platform Eng |
| Stripe Secret Key | Every 180 Days | Finance/Engineering |
| JWT Secret | Annually | DevSecOps Lead |

## Critical Incident Rotation (Compromise Scenario)
If any secret is suspected to be compromised, **IMMEDIATE** rotation is mandatory. Follow the specific key procedure below without waiting for the scheduled window.

---

## 1. Supabase Key & Password Rotation

### Supabase Database Password
1. Inform engineering team of a 5-minute database connectivity blip.
2. Go to Supabase Dashboard > Settings > Database.
3. Under "Database password", click **Reset password**.
4. Generate a new high-entropy password (64+ chars).
5. Immediately update Google Cloud Secret Manager or the `.env.production` configuration.
6. Trigger a zero-downtime redeployment of the Cloud Run instances to pick up the new password.

### Supabase JWT Secret
*Warning: Rotating the JWT secret will invalidate all current user sessions.*
1. Go to Supabase Dashboard > Settings > API.
2. Under "JWT Settings", click **Generate new secret**.
3. Update specific environment variables in Cloud Run if they reference this explicitly.
4. Notify support teams that users will be logged out and must re-authenticate.

## 2. External Provider Key Rotation

### Twilio
1. Log in to Twilio Console.
2. Create a Secondary Auth Token.
3. Update OraDesk Cloud Run environment variables (`TWILIO_AUTH_TOKEN`) with the secondary token.
4. Deploy the application.
5. Verify outbound calling works: `curl -X POST https://api.oradesk.com/health/detailed` (Check circuit breakers).
6. Once verified, promote the Secondary Auth Token to Primary in Twilio.

### Google Gemini API Keys
1. Google Cloud Console > APIs & Services > Credentials.
2. Create a new API Key for the Gemini service.
3. Add the old key's deletion date to your calendar (wait 24h).
4. Update OraDesk Cloud Run configuration (`GEMINI_API_KEY`).
5. Wait for the new revision to spin up.
6. Delete the old key in Google Cloud Console.

### Stripe
1. Log into Stripe Dashboard > Developers > API keys.
2. Click **Roll key** on the pertinent Secret key or Webhook Signing Secret.
3. Select "Expire immediately" (for compromised keys) or "Expire in 24 hours" (for routine rotation).
4. Update `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Cloud Run env vars.
5. Monitor Stripe webhook delivery logs for errors.

## Post-Rotation Checklist
- [ ] Ensure all automated tests (E2E) pass against the staging environment (if applicable).
- [ ] Monitor application logs (`system.error` rate) for 30 minutes post-rotation.
- [ ] Mark the rotation task as complete in the central security tracking system (e.g., Jira compliance board).
