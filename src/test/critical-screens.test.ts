import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Critical Screen Regression Tests
 *
 * These test the source code of the three most important screens:
 * 1. Dashboard — ROI metrics, SystemHealth, action alerts
 * 2. CallLogs — call history, search, status display
 * 3. Patients — patient list, search, contact info
 *
 * We test against raw source to avoid heavy dependency mocking
 * (ClinicContext, Supabase, react-router, etc.) while still catching
 * structural regressions that would break the receptionist experience.
 */

// ── Load Sources ────────────────────────────────────────────

const dashboardSource = fs.readFileSync(
    path.resolve(__dirname, '../pages/Dashboard.tsx'),
    'utf-8',
);

const callLogsSource = fs.readFileSync(
    path.resolve(__dirname, '../pages/CallLogs.tsx'),
    'utf-8',
);

const patientsSource = fs.readFileSync(
    path.resolve(__dirname, '../pages/Patients.tsx'),
    'utf-8',
);

const tasksSource = fs.readFileSync(
    path.resolve(__dirname, '../pages/Tasks.tsx'),
    'utf-8',
);

// ── Dashboard Tests ─────────────────────────────────────────

describe('Dashboard — Critical Structure', () => {
    it('imports and uses useROIMetrics hook', () => {
        expect(dashboardSource).toContain("useROIMetrics");
        expect(dashboardSource).toContain("from '@/hooks/useROIMetrics'");
    });

    it('imports and uses useSystemHealth hook', () => {
        expect(dashboardSource).toContain("useSystemHealth");
        expect(dashboardSource).toContain("from '@/hooks/useSystemHealth'");
    });

    it('passes real health data to SystemHealth component', () => {
        expect(dashboardSource).toContain("healthData?.status");
        expect(dashboardSource).toContain("healthData?.circuitBreakers");
        expect(dashboardSource).toContain("healthData?.database?.connected");
    });

    it('renders ROI data from hook (not hardcoded)', () => {
        expect(dashboardSource).toContain("roiData?.totalCalls30d");
        expect(dashboardSource).toContain("roiData?.appointmentsBooked30d");
        expect(dashboardSource).toContain("roiData?.confirmedRevenue30d");
        expect(dashboardSource).toContain("roiData?.staffHoursSaved");
    });

    it('does NOT contain old mocked ClinicROIMetrics interface', () => {
        expect(dashboardSource).not.toContain("interface ClinicROIMetrics");
        expect(dashboardSource).not.toContain("appointmentsCreatedByAI:");
        expect(dashboardSource).not.toContain("patientSatisfaction:");
    });

    it('renders StatCard components', () => {
        expect(dashboardSource).toContain('StatCard');
        expect(dashboardSource).toContain('Revenue Generated');
        expect(dashboardSource).toContain('Total AI Calls');
    });

    it('renders SystemHealth component', () => {
        expect(dashboardSource).toContain('<SystemHealth');
    });
});

// ── Call Logs Tests ─────────────────────────────────────────

describe('CallLogs — Critical Structure', () => {
    it('renders a search/filter UI', () => {
        // Should have search functionality
        expect(callLogsSource).toMatch(/search|filter|Search|Filter/i);
    });

    it('references call status types', () => {
        // Should handle various call statuses
        expect(callLogsSource).toMatch(/completed|in-progress|failed|queued/);
    });

    it('displays patient information', () => {
        expect(callLogsSource).toMatch(/patient|Patient/);
    });

    it('references call duration', () => {
        expect(callLogsSource).toMatch(/duration|Duration/i);
    });

    it('uses useAICalls or similar data hook', () => {
        expect(callLogsSource).toMatch(/useAICalls|useCallLogs|useCalls/);
    });
});

// ── Patients Tests ──────────────────────────────────────────

describe('Patients — Critical Structure', () => {
    it('has search capability', () => {
        expect(patientsSource).toMatch(/search|Search|filter|Filter/i);
    });

    it('references patient name fields', () => {
        expect(patientsSource).toMatch(/first_name|firstName|last_name|lastName/);
    });

    it('references contact information', () => {
        expect(patientsSource).toMatch(/phone|email|Phone|Email/i);
    });

    it('uses a patient data hook', () => {
        expect(patientsSource).toMatch(/usePatients|usePatient|patients/);
    });
});

// ── Tasks Tests ──────────────────────────────────────────────

describe('Tasks — Receptionist UX Features', () => {
    it('has Today date filter as default', () => {
        expect(tasksSource).toContain("useState<DateFilter>('today')");
    });

    it('imports isToday from date-fns', () => {
        expect(tasksSource).toContain('isToday');
    });

    it('has one-click callback button', () => {
        expect(tasksSource).toContain('Call Back');
        expect(tasksSource).toContain('task.patient?.phone');
    });

    it('renders Today/All toggle buttons', () => {
        expect(tasksSource).toContain("setDateFilter('today')");
        expect(tasksSource).toContain("setDateFilter('all')");
    });

    it('uses useMemo for filtered tasks', () => {
        expect(tasksSource).toContain('useMemo');
        expect(tasksSource).toContain('filteredTasks');
    });
});
