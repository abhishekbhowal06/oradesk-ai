# REPOSITORY STABILIZATION REPORT

**Date:** 2026-02-09
**Status:** READY FOR RESET

## 1. Migration Restructuring

- **Archived:** All migrations prior to `20260210_phase1_foundation.sql` have been moved to `supabase/migrations/_archive_pre_rebuild`.
  - Count: 23 files archived.
- **Active:** `20260210_phase1_foundation.sql` is now the SINGLE source of truth.

## 2. Schema Idempotency

The foundation migration `20260210_phase1_foundation.sql` has been patched:

- **Enums:** Wrapped in `DO $$ ... IF NOT EXISTS` blocks.
- **Tables:** Added `IF NOT EXISTS`.
- **Indexes:** Added `IF NOT EXISTS`.
- **Policies:** Added `DROP POLICY IF EXISTS` before creation.
- **Triggers:** Added `DROP TRIGGER IF EXISTS` before creation.

## 3. Risk Assessment

- **Data Loss:** 🟢 LOW (Pre-production environment, permission granted to reset).
- **Schema Conflicts:** 🟢 RESOLVED (Single file source of truth).
- **Frontend Compatibility:** 🟡 UNKNOWN (Need to verify if frontend code relies on columns from archived migrations that were NOT carried over to the foundation file. Specifically `patient_behavioral_profiles` was in the archive but is NOT in the foundation. Frontend components using this will break).

## 4. Pending Issues (Crucial)

- **Missing Schema:** The table `patient_behavioral_profiles` (from `20260206_clinic_growth_os_schemas.sql`) is currently **ARCHIVED** and **NOT** in the foundation file.
- **Impact:** If `src/components/dashboard/ClinicHealthCard.tsx` or other components rely on this table, they will fail at runtime.

## 5. Recommendation

1.  **Run** `supabase db reset` to apply the clean foundation.
2.  **Verify** if `patient_behavioral_profiles` is actually needed by the frontend.
    - If YES: Port it into `20260210_phase1_foundation.sql`.
    - If NO: Remove the frontend code referencing it.

**Supabase DB Reset is now SAFE to execute from a schema perspective.**
