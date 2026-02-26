# PMS Terms of Service Compliance Framework

## Legal Compliance Review — OraDesk PMS Bridge

> **Status**: Framework defined. Legal counsel review required before production deployment.
> **Last Updated**: 2026-02-23
> **Applies To**: OpenDental, Dentrix, Eaglesoft integrations

---

## 1. OpenDental Compliance Assessment

### 1.1 OpenDental Licensing Model

OpenDental is **open-source** (GPL v2 license). Key compliance points:

| Concern | Assessment | Status |
|---------|-----------|--------|
| **Database Access** | OpenDental explicitly supports direct MySQL access for third-party integrations. The official documentation provides database schema references. | ✅ Compliant |
| **GPL License** | Our bridge agent reads from the DB — it does NOT link to or distribute OpenDental code. No GPL obligation triggered. | ✅ Compliant |
| **API vs Direct DB** | OpenDental provides a REST API (Open Dental API) but also documents direct MySQL access. Both are supported integration paths. | ✅ Both supported |
| **Write Operations** | Direct MySQL writes to appointment table are supported. OpenDental documents the schema for third-party scheduling integrations. | ✅ Compliant |
| **Data Ownership** | Patient data belongs to the clinic. OpenDental does not restrict transmission of clinic-owned data to authorized third-party services. | ✅ Compliant |

### 1.2 OpenDental API Key Alternative

For clinics preferring API-over-DB access:

```
Future Phase:
  - OpenDental API endpoint: https://api.opendental.com/api/v1/
  - Requires per-clinic API key from OpenDental HQ
  - Rate limited to 200 requests/min
  - Our bridge can support both API and direct DB modes
```

**Recommendation**: Start with direct MySQL (faster, no API key dependency).  
Offer OpenDental API as an alternative for clinics with compliance concerns.

---

## 2. HIPAA Compliance Checklist

### 2.1 Technical Safeguards ✅

| Requirement | Implementation | Evidence |
|-------------|---------------|----------|
| **Access Control** | Token-based device auth, one device per clinic, RLS on all tables | `bridge_devices.device_token_hash`, UNIQUE(clinic_id) |
| **Audit Controls** | Every read/write logged in `pms_bridge_audit_log` | Audit log with direction, entity_type, record_count, duration |
| **Integrity Controls** | Checksum-based change detection, conflict detection before writes | `pms_entity_map.pms_checksum`, `checkSlotConflict()` |
| **Transmission Security** | TLS 1.3 via Supabase SDK, no insecure fallback | HTTPS enforced, no HTTP endpoints |
| **Encryption at Rest** | AES-256-CBC for local cache (sync state, offline queue, config) | `encrypt()` / `decrypt()` in sync-agent.ts |

### 2.2 Administrative Safeguards ✅

| Requirement | Implementation |
|-------------|---------------|
| **Risk Analysis** | Bridge Health Monitor performs continuous risk assessment |
| **Workforce Training** | Setup wizard guides admin through security best practices |
| **Access Management** | Read-only MySQL user for data sync, limited write scope |
| **Contingency Plan** | Offline queue, auto-retry, graceful degradation |
| **Device Security** | Device fingerprinting, token-based auth, remote revocation |

### 2.3 Physical Safeguards

| Requirement | Note |
|-------------|------|
| **Facility Access** | Bridge runs on clinic's existing server — inherits clinic's physical security |
| **Workstation Security** | Windows service runs under restricted service account |
| **Device Controls** | One device per clinic, remote suspension capability |

---

## 3. Business Associate Agreement (BAA)

### Required Before Production Deployment

A BAA must be executed between:
- **OraDesk AI** (Business Associate) 
- **Clinic** (Covered Entity)

The BAA must cover:

1. **Permitted Uses**: OraDesk may access, store, and process PHI solely for appointment scheduling, patient outreach, and practice management integration.
2. **Safeguards**: OraDesk implements administrative, technical, and physical safeguards as documented in this compliance framework.
3. **Reporting**: OraDesk will report any security incidents within 72 hours.
4. **Subcontractors**: Supabase operates as a subcontractor and maintains its own BAA with OraDesk.
5. **Termination**: Upon termination, OraDesk will return or destroy all PHI within 30 days.
6. **PHI Handling**: No raw PHI in logs. All identifiers are SHA-256 hashed before logging.

### Supabase BAA

Supabase provides HIPAA-compliant hosting with a signed BAA:
- Reference: https://supabase.com/docs/guides/platform/hipaa
- Supabase Pro plan or higher required
- Encryption at rest (AES-256)
- SOC 2 Type II certified

---

## 4. PMS-Specific TOS Compliance Matrix

### 4.1 OpenDental

| TOS Clause | Our Approach | Compliant? |
|------------|-------------|-----------|
| Open-source GPL v2 | No OpenDental code is distributed or linked. Bridge reads DB directly. | ✅ |
| Database access | OpenDental documents MySQL schema for third-party use. | ✅ |
| Patient data ownership | Data belongs to clinic. We are acting as clinic's authorized agent. | ✅ |
| API rate limits (if using API) | Not applicable for direct DB. If using API: implement rate limiting. | ✅ |

### 4.2 Dentrix (Future)

| TOS Clause | Our Approach | Risk |
|------------|-------------|------|
| DTXAPI usage | Henry Schein requires a developer agreement for Dentrix API access. | ⚠️ Agreement needed |
| Database access | Dentrix uses a proprietary DB. Direct access is restricted by TOS. | ⚠️ API-only access required |
| Developer Portal | Must register at developer.henryschein.com | ⚠️ Registration pending |
| Branding | Must not use "Dentrix" name in marketing without approval | ⚠️ Review needed |

### 4.3 Eaglesoft (Future)

| TOS Clause | Our Approach | Risk |
|------------|-------------|------|
| Patterson API | Patterson Dental provides limited API access. | ⚠️ Partnership may be required |
| Database access | Uses MS SQL Server. Direct access varies by clinic setup. | ⚠️ Case-by-case |
| Integration approval | May require formal integration partner agreement. | ⚠️ Review needed |

---

## 5. Data Processing Addendum (DPA)

### For GDPR-Covered Clinics (EU/UK)

If serving clinics in GDPR jurisdictions, an additional DPA must include:

1. **Lawful Basis**: Legitimate interest for patient care, consent for marketing outreach
2. **Data Minimization**: Only sync fields needed for scheduling (name, phone, appointment time, procedure)
3. **Storage Limitation**: Local cache auto-expires after 7 days
4. **Deletion Rights**: Support for patient data deletion requests within 72 hours
5. **Cross-Border Transfers**: Supabase region selection to keep data in-jurisdiction

---

## 6. Compliance Enforcement in Code

### 6.1 PHI-Safe Logging (Enforced)

```typescript
// ❌ NEVER DO THIS:
logger.info('Syncing patient John Doe, phone: +15551234567');

// ✅ ALWAYS DO THIS:
logger.info('Syncing patient', { pms_id_hash: hashId(patientPmsId) });
// Output: "Syncing patient { pms_id_hash: 'a1b2c3d4' }"
```

### 6.2 Write Scope Limitation (Enforced)

```typescript
// The OpenDentalConnector ONLY exposes these write methods:
// 1. createAppointment()   — INSERT appointment
// 2. updateAppointmentStatus() — UPDATE appointment SET AptStatus

// No other write operations exist in the codebase.
// No DELETE operations exist.
// No schema modification operations exist.
```

### 6.3 Credential Isolation (Enforced)

```typescript
// MySQL credentials are:
// 1. Encrypted at rest (AES-256 in bridge_config.enc)
// 2. Never transmitted to cloud (stored locally only)
// 3. Never logged (even in debug mode)
// 4. Scoped to read-only + appointment write
```

---

## 7. Pre-Production Legal Checklist

- [ ] **Legal counsel review** of this compliance framework
- [ ] **BAA template** drafted and approved by legal
- [ ] **OpenDental community forum** confirmation of direct DB access policy
- [ ] **Supabase BAA** executed (Pro plan activation)
- [ ] **Privacy policy update** to include PMS data processing
- [ ] **Terms of Service update** to include bridge agent deployment
- [ ] **Dentrix developer agreement** submission (for Phase 2)
- [ ] **Cyber liability insurance** verification covering data bridge operations
- [ ] **Penetration test** of bridge agent and cloud API
- [ ] **HIPAA risk assessment** documented and signed by compliance officer

---

## 8. Incident Response Plan

### Bridge-Specific Security Incidents

| Incident | Response | Timeline |
|----------|----------|----------|
| Device token compromised | Revoke device (`status = 'revoked'`), generate new activation code | Immediate |
| PHI found in logs | Purge affected log entries, investigate root cause, report to covered entity | < 24 hours |
| Unauthorized PMS access | Suspend bridge, rotate MySQL credentials, investigate | Immediate |
| Data breach (sync data exposed) | Breach notification per HIPAA, notify affected clinics | < 72 hours |
| Agent update compromised | Rollback to backup, verify checksum chain, suspend auto-updates | Immediate |

---

*This document is a compliance framework, not legal advice. Consult HIPAA counsel before production deployment.*
