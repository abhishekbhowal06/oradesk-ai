# SOC2 Controls Mapping — OraDesk AI

**Scope**: Security, Availability, and Confidentiality (TSC)
**Date**: 2026-02-25

## 1. Security (CC Series)

### CC6.1: Logical Access
- **Control**: Multi-factor Authentication (MFA) enabled for all administrative accounts.
- **Implementation**: Managed via Supabase Auth & GCP IAM.

### CC7.2: Vulnerability Management
- **Control**: Automated dependency scanning and security header enforcement.
- **Implementation**: `helmet` middleware, `npm audit` in CI/CD, and GCP Container Analysis.

### CC8.1: Change Management
- **Control**: All code changes require peer review and automated build verification.
- **Implementation**: GitHub PR enforcement and CI/CD pipelines in `deploy-service.sh`.

## 2. Availability (A Series)

### A1.2: System Monitoring
- **Control**: Real-time monitoring of system health and circuit breaker states.
- **Implementation**: `/v2/ops/public-status` and Prometheus metrics at `/metrics`.

### A1.3: Disaster Recovery
- **Control**: Multi-region deployment and automated database backups.
- **Implementation**: `deploy-service.sh` regional fleet management and Supabase daily snapshots.

## 3. Confidentiality (C Series)

### C1.1: Data Classification
- **Control**: PII/PHI is identified and handled via redaction utilities and RLS.
- **Implementation**: `pii-redaction.ts` and `supabaseUser` RLS client.

---

## Control ID Reference Table

| Control ID | Description | Implementation Path |
| :--- | :--- | :--- |
| AC-01 | Access Control | `middleware/auth.ts` |
| AU-01 | Audit Logging | `lib/audit-logger.ts` |
| CM-01 | Change Management | `deploy-service.sh` |
| IR-01 | Incident Response | `lib/operations-reliability.ts` |
| SC-01 | System & Comm | `docs/CDN_ARCHITECTURE.md` |
