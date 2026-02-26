# HIPAA Compliance Review — OraDesk AI

**Status**: FINAL DRAFT (Week 12 Review)
**Date**: 2026-02-25

## 1. PHI Handling & Data Privacy
OraDesk AI is designed to handle Protected Health Information (PHI) in accordance with HIPAA standards.

### Data at Rest (Encryption)
- All database volumes (Supabase/Postgres) are encrypted at rest using AES-256.
- PHI fields (patient names, phone numbers, date of birth) are stored within protected schemas.

### Data in Transit
- All API communication is forced over HTTPS (TLS 1.2+).
- HSTS headers are implemented to prevent protocol downgrade attacks.

### PII Redaction
- The `pii-redaction.ts` utility is used to scrub PHI from logs and AI prompts before they are sent to external LLMs (where BAA is not in place).
- Audit logs contain metadata only; actual PHI remains in the encrypted database.

## 2. Access Control
- **Row Level Security (RLS)**: Strictly enforced at the database level. Staff members can only access patients and appointments belonging to their own clinic.
- **Service Role Isolation**: Administrative actions are restricted to the `service_role` key, which is stored securely in GCP Secret Manager.

## 3. Compliance Checklist

| Control | Status | Evidence |
| :--- | :--- | :--- |
| Encryption at Rest | ✅ | GCP/Supabase Platform Default |
| Encryption in Transit | ✅ | TLS 1.3 enforced by Load Balancer |
| Audit Trail | ✅ | `audit_log` table implemented |
| PII Scrubbing | ✅ | `pii-redaction.ts` active in logic |
| Data Deletion API | ✅ | GDPR/CCPA compliant deletion route |
| RLS Verification | ✅ | Unified RLS policy applied Feb 2026 |

---

## 4. Next Steps
- Annual HIPAA training for all staff with system access.
- Quarterly RLS policy audits.
- Verification of Twilio BAA (Business Associate Agreement) coverage.
