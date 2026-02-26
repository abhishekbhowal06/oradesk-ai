import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Dashboard ROI section regression tests.
 * Verifies that the ClinicROIMetrics interface and clinic-friendly
 * ROI card labels exist in the Dashboard source.
 */

const dashboardSource = fs.readFileSync(
    path.resolve(__dirname, '../pages/Dashboard.tsx'),
    'utf-8',
);

describe('Dashboard – Clinic-Friendly ROI Cards', () => {
    it('has ClinicROIMetrics interface defined', () => {
        expect(dashboardSource).toContain('interface ClinicROIMetrics');
        expect(dashboardSource).toContain('appointmentsCreatedByAI: number');
        expect(dashboardSource).toContain('recoveredNoShows: number');
        expect(dashboardSource).toContain('estimatedExtraRevenue: number');
        expect(dashboardSource).toContain('staffHoursSaved: number');
    });

    const expectedROILabels = [
        'Appointments Created by AI',
        'Recovered No-Shows',
        'Estimated Extra Revenue',
        'Patient Satisfaction',
    ];

    it.each(expectedROILabels)('contains ROI card label: "%s"', (label) => {
        expect(dashboardSource).toContain(label);
    });

    const expectedSubLabels = [
        'Booked by AI calls',
        'Recovered by follow-ups',
        'From recovered appointments',
        'From patient feedback',
    ];

    it.each(expectedSubLabels)('contains ROI sub-label: "%s"', (label) => {
        expect(dashboardSource).toContain(label);
    });

    const bannedLabels = [
        'Command Center',
        'NEURAL SCAN ACTIVE',
        'Monthly_Impact_Audit',
        'Clinic_Control_Center_v4.5',
        'SUBJECTS REQUIRE MANUAL PROTOCOL ESCALATION',
        'RECOVERED FROM SLIPPAGE',
        'COMPLETED PROTOCOLS',
        'NO-SHOWS PREVENTED',
        'AUTOMATION YIELD',
        'By AI Broadcaster',
        'Via CareLoops',
        'Signal Feedback',
        'AVG_LATENCY',
        'FAULT_COUNT',
        'AUTO_RESOLVE',
        'System Event Log',
        'Deployment Queue',
        'Recent Transmissions',
    ];

    it.each(bannedLabels)('does NOT contain banned label: "%s"', (label) => {
        expect(dashboardSource).not.toContain(label);
    });

    it('uses clinic-friendly section headers', () => {
        expect(dashboardSource).toContain("Today's Appointments");
        expect(dashboardSource).toContain('Recent AI Calls');
        expect(dashboardSource).toContain('Activity Feed');
        expect(dashboardSource).toContain("This Month's Impact");
    });
});
