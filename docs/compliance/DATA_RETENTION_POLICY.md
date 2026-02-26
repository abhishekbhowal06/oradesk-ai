# Data Retention and Backup Policy

## Purpose
This document outlines the data retention periods and backup procedures for OraDesk AI to ensure compliance with SOC2, GDPR, and HIPAA (where applicable).

## Data Retention Periods

### 1. Patient Records (PHI/PII)
- **Active Patients**: Retained indefinitely while the clinic maintains an active subscription.
- **Deleted Patients (GDPR Art. 17)**: PII (Name, Phone, Email, DOB) is permanently obfuscated/anonymized within 30 days of the request.
- **Churned Clinics**: Complete clinic data is retained in a suspended state for 90 days post-cancellation, then permanently deleted or anonymized.

### 2. Audio Recordings and Call Transcripts
- **Standard Tier**: 30 days retention.
- **Enterprise Tier**: 7 years retention (for medical compliance auditing).
- **Anonymization**: If a patient requests erasure, transcripts are replaced with `[REDACTED]` and audio files are hard-deleted within 72 hours.

### 3. Audit Logs (SOC2 Requirement)
- **Retention**: Immutable audit logs for admin actions, access changes, and system configuration are retained for **7 years**.
- **Immutability**: The `audit_log` table enforces Row-Level Security (RLS) policies that strictly prohibit `UPDATE` and `DELETE` operations by any application or administrative role.

### 4. Telemetry and Application Logs
- **Cloud Run Logs**: 30 days retention via Google Cloud Logging.
- **Metrics (Prometheus)**: 15 months (downsampled after 30 days).

## Backup Procedures

### 1. Database Backups (Supabase)
- **Point-in-Time Recovery (PITR)**: Enabled on all production databases.
- **Retention**:
  - Point-in-time recovery granularity: **Up to 7 days**.
  - Daily logical backups: Retained for **30 days**.
- **Geographic Redundancy**: Backups are replicated to a secondary region automatically by Supabase infrastructure.

### 2. Audio Storage Backups
- **Object Storage**: Stored in Supabase Storage (backed by AWS S3).
- **Versioning**: Object versioning is enabled to prevent accidental overwrites or malicious deletion.
- **Replication**: Cross-region replication enabled to ensure high availability.

## Testing and Verification
- **Backup Testing**: Full database restore tests are conducted to a staging environment **quarterly** to verify data integrity and RTO (Recovery Time Objective).
- **RTO/RPO Metrics**:
  - Target RTO (Recovery Time Objective): < 2 hours for major infrastructure failure.
  - Target RPO (Recovery Point Objective): < 5 minutes (via PITR).
