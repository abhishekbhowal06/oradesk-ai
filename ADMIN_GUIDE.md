# Dentacore OS - IT/Operations Admin Guide

## Overview

This guide is for IT administrators and operations staff responsible for deploying, monitoring, and maintaining the Dentacore OS platform in production.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│ FRONTEND (React + Vite)                             │
│ • Dashboard, Call Logs, Settings                    │
│ • Staff Alert System                                │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ API GATEWAY (Express.js)                            │
│ • /v1/outbound/* - Call initiation                  │
│ • /v1/webhooks/* - Twilio callbacks                 │
│ • /v1/ops/* - Operations health endpoints           │
└──────────────────┬──────────────────────────────────┘
                   │
         ┌─────────┴────────┐
         ▼                  ▼
┌────────────────┐  ┌───────────────┐
│ Supabase       │  │ Twilio        │
│ (PostgreSQL    │  │ (Voice calls) │
│  + Auth + RLS) │  │               │
└────────────────┘  └───────────────┘
```

---

## Environment Variables

### Required for Production

| Variable                  | Purpose                   | Example                     |
| ------------------------- | ------------------------- | --------------------------- |
| `PORT`                    | Backend server port       | `3001`                      |
| `SERVICE_URL`             | Public webhook URL        | `https://api.dentacore.com` |
| `SUPABASE_URL`            | Supabase project URL      | `https://xxx.supabase.co`   |
| `SUPABASE_ANON_KEY`       | Supabase public key       | `eyJhbGc...`                |
| `SUPABASE_SERVICE_KEY`    | Supabase admin key        | `eyJhbGc...` (SECRET)       |
| `TWILIO_ACCOUNT_SID`      | Twilio account ID         | `ACxxx...`                  |
| `TWILIO_AUTH_TOKEN`       | Twilio auth token         | `xxx...` (SECRET)           |
| `TWILIO_PHONE_NUMBER`     | Outbound caller ID        | `+15551234567`              |
| `GEMINI_API_KEY`          | Google AI key             | `AIza...` (SECRET)          |
| `DEEPGRAM_API_KEY`        | Speech-to-text key        | `xxx...` (SECRET, optional) |
| `CLINIC_ESCALATION_PHONE` | Emergency transfer number | `+15559999999` (optional)   |

### Optional (Advanced)

| Variable                  | Default  | Purpose                                      |
| ------------------------- | -------- | -------------------------------------------- |
| `LOG_LEVEL`               | `info`   | Logging verbosity (debug, info, warn, error) |
| `MAX_CONCURRENT_CALLS`    | `50`     | Circuit breaker threshold                    |
| `OPS_MONITOR_INTERVAL_MS` | `300000` | Health check interval (5 min)                |

---

## Deployment Steps

### 1. Initial Setup

```bash
# Clone repository
git clone https://github.com/yourorg/dentacore-os
cd dentacore-os

# Install dependencies
npm install
cd services/ai-calling && npm install && cd ../..

# Configure environment
cp .env.example .env
# Edit .env with production values
```

### 2. Database Migration

```bash
# Run all Supabase migrations
# Method 1: Supabase Dashboard (Recommended)
# - Log in to Supabase Dashboard
# - Go to SQL Editor
# - Copy contents of supabase/migrations/*.sql
# - Execute in order (20260205120000_operations_reliability.sql, etc.)

# Method 2: Supabase CLI (if available)
supabase db push
```

### 3. Build Frontend

```bash
npm run build
# Output: dist/ folder ready for hosting
```

### 4. Start Services

```bash
# Production backend
cd services/ai-calling
npm run build
npm start  # Runs on PORT from .env

# Serve frontend (static hosting)
# Deploy dist/ to Vercel, Netlify, or CDN
```

---

## Monitoring & Health Checks

### Operational Endpoints

#### System Health

```bash
GET /api/v1/ops/system-status
```

Returns overall system health:

```json
{
  "healthy": true,
  "totalCalls": 1250,
  "activeConnections": 8,
  "circuitBreakerOpen": false,
  "lastHealthCheck": "2026-02-06T14:00:00Z"
}
```

#### Clinic Health

```bash
GET /api/v1/ops/health/:clinicId
```

Returns clinic-specific operational signals.

#### Incident Playbooks

```bash
GET /api/v1/ops/playbook/:scenario
# Scenarios: twilio_down, database_slow, patient_angry
```

### Logs

**Location:** `services/ai-calling/logs/` (if file logging enabled)

**Structure (JSON):**

```json
{
  "timestamp": "2026-02-06T14:00:00Z",
  "level": "info",
  "message": "Call initiated",
  "callId": "uuid",
  "clinicId": "uuid"
}
```

**Key log messages:**

- `"Call initiated"` - Outbound call started
- `"Emergency detected"` - Patient used emergency phrase
- `"Circuit breaker opened"` - System overloaded
- `"Auto-recovery executed"` - Automated failure recovery

---

## Common Issues & Resolution

### Issue: Calls Not Initiating

**Symptoms:** `/v1/outbound/initiate` returns 403 or 500

**Checks:**

1. Verify `TWILIO_PHONE_NUMBER` is set
2. Check Twilio account balance
3. Verify clinic automation is enabled: `SELECT ai_confirmation_enabled FROM clinics WHERE id = ?`
4. Check patient consent: `SELECT * FROM patient_consent WHERE patient_id = ?`

**Resolution:**

```sql
-- Enable automation
UPDATE clinics SET ai_confirmation_enabled = true WHERE id = 'xxx';

-- Grant consent
INSERT INTO patient_consent (patient_id, consent_granted) VALUES ('xxx', true);
```

---

### Issue: High Escalation Rate

**Symptoms:** >20% of calls escalate to staff

**Checks:**

```sql
SELECT escalation_reason, COUNT(*)
FROM ai_calls
WHERE created_at > now() - interval '7 days'
  AND escalation_required = true
GROUP BY escalation_reason;
```

**Common causes:**

- `silence` - Phone not answering → Review timing/retry logic
- `ambiguous` - AI unsure → Refine prompts or lower confidence threshold
- `emergency_phrase` - Patients using keywords → Expected behavior

---

### Issue: Twilio Webhook Failures

**Symptoms:** Calls connect but AI doesn't respond

**Checks:**

1. Verify `SERVICE_URL` is publicly accessible
2. Check Twilio webhook logs in Twilio Console
3. Verify SSL certificate is valid

**Debug:**

```bash
# Test webhook endpoint
curl https://your-service-url.com/v1/webhooks/twilio/voice?call_id=test

# Should return 200 OK with TwiML
```

---

### Issue: Database Connection Lost

**Symptoms:** `Error: Supabase client failed`

**Resolution:**

1. Check Supabase project status
2. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
3. Check network connectivity
4. Review RLS policies (should allow service role)

---

## Security Checklist

- [ ] `SUPABASE_SERVICE_KEY` is kept secret (use env vars, not committed to git)
- [ ] `TWILIO_AUTH_TOKEN` is kept secret
- [ ] `GEMINI_API_KEY` is kept secret
- [ ] Frontend uses `SUPABASE_ANON_KEY` (public key) only
- [ ] Row Level Security (RLS) is enabled on all Supabase tables
- [ ] Webhook endpoints validate Twilio signatures (optional, advanced)
- [ ] API rate limiting is configured (optional, advanced)

---

## Performance Tuning

### Database Indexes

Ensure these indexes exist:

```sql
CREATE INDEX idx_ai_calls_clinic_id ON ai_calls(clinic_id);
CREATE INDEX idx_ai_calls_created_at ON ai_calls(created_at DESC);
CREATE INDEX idx_ai_calls_escalation ON ai_calls(escalation_required) WHERE escalation_required = true;
```

### Caching

Consider adding Redis for:

- Clinic settings cache (TTL 5 min)
- Patient consent cache (TTL 10 min)
- Health check results (TTL 30 sec)

### Scaling

**Vertical:** Increase server resources when `MAX_CONCURRENT_CALLS` is frequently hit

**Horizontal:** Deploy multiple backend instances behind load balancer

---

## Backup & Recovery

### Database Backups

Supabase provides automatic daily backups. Manual backup:

```bash
# Export critical tables
supabase db dump --data-only > backup.sql
```

### Configuration Backup

Store `.env` securely in secrets manager (AWS Secrets Manager, Google Secret Manager).

---

## Monitoring Dashboard (Future)

Recommended metrics to track:

- Call success rate (target >80%)
- Escalation rate (target <15%)
- Average call duration
- Circuit breaker trips per hour
- API latency (95th percentile)

Use tools: Datadog, New Relic, or custom Grafana + Prometheus.

---

## Support Contacts

**System Issues:** ops@dentacore.com  
**Twilio Support:** support.twilio.com  
**Supabase Support:** support.supabase.com
