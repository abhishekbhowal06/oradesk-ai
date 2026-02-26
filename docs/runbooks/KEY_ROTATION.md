# 🔐 SECURITY RUNBOOK: API Key Rotation

**Classification:** CONFIDENTIAL - INTERNAL ONLY  
**Applicability:** ALL ENVIRONMENTS  
**Compliance Standard:** SOC2 Type II, HIPAA  

This document outlines the zero-downtime standard operating procedure for rotating critical infrastructure credentials.

---

## 1. Supabase Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`)

The Service Role Key bypasses all Row Level Security (RLS). A leak of this key is a **Severity 1** incident.

### Routine Rotation (Every 90 Days)
1. Navigate to Supabase Dashboard → Project Settings → API.
2. Under "Project API keys", locate the `service_role` key.
3. Generate a **Secondary Key** (Supabase allows multiple active keys temporarily for rotation).
4. Update the Google Cloud Secret Manager:
   ```bash
   echo -n "NEW_KEY_HERE" | gcloud secrets versions add SUPABASE_SERVICE_ROLE_KEY --data-file=-
   ```
5. Deploy a new Cloud Run revision (forces new secrets to load):
   ```bash
   ./deploy-service.sh
   ```
6. Verify the new deployment is healthy and traffic is flowing.
7. Return to Supabase Dashboard and **Revoke** the old Primary Key.

### Emergency Revocation (Leak Detected)
1. **IMMEDIATELY** revoke the compromised key in the Supabase Dashboard. This will cause downtime.
2. Generate a new key.
3. Update Secret Manager and redeploy (Steps 4-5 above).
4. Post-incident: Review `audit_logs` for unauthorized access during the exposure window.

---

## 2. Gemini API Keys (`GEMINI_API_KEY`)

We use a comma-separated list of Gemini API keys for round-robin throughput scaling (`GeminiKeyRotation` class).

1. Generate new API keys in Google AI Studio.
2. Update the comma-separated string in Secret Manager:
   ```bash
   echo -n "KEY_1,KEY_2,KEY_3" | gcloud secrets versions add GEMINI_API_KEY --data-file=-
   ```
3. Deploy new revision: `./deploy-service.sh`
4. Revoke old keys in Google AI Studio.

---

## 3. Twilio Auth Token (`TWILIO_AUTH_TOKEN`)

Twilio auth tokens are used to sign requests and validate incoming webhooks.

1. Navigate to Twilio Console → Account Info → Auth Tokens.
2. Click **Create Secondary Auth Token**. (Provides 24 hours of dual-key validity).
3. Update Secret Manager:
   ```bash
   echo -n "SECONDARY_TOKEN_HERE" | gcloud secrets versions add TWILIO_AUTH_TOKEN --data-file=-
   ```
4. Deploy new revision: `./deploy-service.sh`
5. Verify outbound and inbound calls function correctly.
6. Return to Twilio Console and click **Promote to Primary**. The old token is immediately invalidated.

---

## Post-Rotation Checklist
- [ ] Verify `GET /v1/ops/health/:clinicId` shows healthy.
- [ ] Place test outbound call to ensure Twilio/Gemini integration is active.
- [ ] Document rotation event in internal SOC2 compliance registry with timestamp and executor name.
