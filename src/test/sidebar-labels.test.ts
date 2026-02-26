import { describe, it, expect } from 'vitest';

/**
 * Sidebar label regression tests.
 * These ensure that clinic-friendly labels are used in the navigation
 * and that no sci-fi labels can sneak back in.
 */

// We test against the raw source rather than rendering the full component
// because Sidebar depends on ClinicContext, react-router, and Supabase.
// This approach is fast, dependency-free, and catches label regressions.

import * as fs from 'fs';
import * as path from 'path';

const sidebarSource = fs.readFileSync(
    path.resolve(__dirname, '../components/layout/Sidebar.tsx'),
    'utf-8',
);

describe('Sidebar – Clinic-Friendly Labels', () => {
    const expectedLabels = [
        'Dashboard',
        'Calendar',
        'Patients',
        'Call History',
        'Campaigns',
        'AI Insights',
        'Integrations',
        'Tasks',
        'Analytics',
        'Settings',
    ];

    it.each(expectedLabels)('contains nav label: "%s"', (label) => {
        expect(sidebarSource).toContain(`label: '${label}'`);
    });

    const bannedLabels = [
        'PRACTICE_DASHBOARD',
        'CLINICAL_CALENDAR',
        'PATIENT_REGISTRY',
        'CALL_HISTORY',
        'CAMPAIGN_MANAGER',
        'AI_INTELLIGENCE',
        'DAILY_TASKS',
        'RESULTS_ANALYTICS',
        'CLINIC_SETTINGS',
        'OPERATIONAL_OS_v4',
        'ACTIVE_NODE_CELL',
        'Available_Clusters',
        'NODE_0',
        'SYN_OS_LOCKED',
        'KERNEL_v1.7.F',
        'CPU_UTIL',
        'NET_LAT',
        'Hide_Sidebar',
        'Book_Appointment',
    ];

    it.each(bannedLabels)('does NOT contain sci-fi label: "%s"', (label) => {
        expect(sidebarSource).not.toContain(label);
    });

    it('uses "Clinic OS" branding', () => {
        expect(sidebarSource).toContain('Clinic OS');
    });

    it('uses "Active Clinic" and "Your Clinics"', () => {
        expect(sidebarSource).toContain('Active Clinic');
        expect(sidebarSource).toContain('Your Clinics');
    });
});
