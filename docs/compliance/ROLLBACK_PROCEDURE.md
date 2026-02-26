# Rollback Procedure

## Overview
This document outlines the standard operating procedure for rolling back deployments in the OraDesk AI environment. Because the system relies heavily on database state, rollbacks must be coordinated between application code (Cloud Run) and the database (Supabase).

## Prerequisites
- Access to Google Cloud Console (Cloud Run Admin)
- Access to Supabase Dashboard (Database Admin)
- GitHub Admin access (for CI/CD intervention)

## Scenario 1: Application-Only Issue (No DB Changes)
If a deployment introduced a visual bug, API error, or logic flaw, but *no database migrations were applied*, the rollback is straightforward.

1. **Identify Previous Stable Revision**:
   - Go to Google Cloud Console > Cloud Run > `oradesk-ai-api`.
   - Navigate to the **Revisions** tab.
   - Locate the last known good revision (check deployment timestamps).
2. **Route Traffic**:
   - Click **Manage Traffic**.
   - Select the previous stable revision.
   - Assign **100%** traffic to it.
   - Click **Save**.
3. **Verify**:
   - Run a basic health check: `curl https://api.oradesk.com/health/detailed`
   - Ensure the bug is no longer present.
4. **Post-Mortem**:
   - Revert the bad commit in GitHub (`git revert <commit-hash>`).
   - Push to `main` to ensure the CI/CD pipeline matches the deployed state.

## Scenario 2: Database Migration Rollback (Data Additive)
If a deployment included a database migration that added tables, columns, or non-destructive changes, but the application code is failing:

1. **Rollback Application Code**:
   - Follow **Scenario 1** to route 100% traffic to the previous Cloud Run revision.
2. **Evaluate Database State**:
   - Since the previous code version does not know about the new tables/columns, it will ignore them.
   - **Action**: Leave the database as-is to avoid accidental data loss. Fix the application code and redeploy.
3. **Optional Down Migration** (only if the new schema is causing performance issues):
   - Access the Supabase SQL Editor.
   - Run the reverse operations (e.g., `DROP TABLE`, `ALTER TABLE DROP COLUMN`).
   - *Warning: This requires extreme caution and should only be done by a Lead Engineer.*

## Scenario 3: Destructive Database Migration Rollback
If a deployment included destructive database changes (dropped columns, altered types) and data corruption is occurring:

1. **Halt the System**:
   - Immediately scale Cloud Run minimum and maximum instances to `0` to stop all traffic and prevent further corruption.
2. **Initiate Point-in-Time Recovery (PITR)**:
   - Go to Supabase Dashboard > Database > Backups.
   - Select **Point in Time Recovery**.
   - Choose a timestamp perfectly preceding the bad deployment.
   - Initiate the restore (this may take 15-45 minutes depending on database size).
3. **Rollback Application Code**:
   - In Cloud Run, set the traffic to 100% for the previous stable revision.
4. **Resume Service**:
   - Once PITR is complete, scale Cloud Run back to normal operating parameters (Min: 3, Max: 50).
   - Inform stakeholders of the downtime and recovery status.

## Incident Communication
During any rollback involving downtime or data issues, the incident commander must update the status page every 15 minutes until resolution.
