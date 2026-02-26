import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SystemHealth } from '@/components/dashboard/SystemHealth';
import type { SystemHealthStatus } from '@/components/dashboard/SystemHealth';

describe('SystemHealth', () => {
    it('renders "All systems healthy" when all subsystems are healthy', () => {
        render(<SystemHealth />);
        expect(screen.getByText('All systems healthy')).toBeInTheDocument();
        expect(screen.getByText('System Status')).toBeInTheDocument();
        expect(screen.getByText('SECURE')).toBeInTheDocument();
    });

    it('renders degraded messages for telephony', () => {
        const status: SystemHealthStatus = {
            overall: 'degraded',
            telephony: 'degraded',
            pmsSync: 'healthy',
            aiEngine: 'healthy',
        };
        render(<SystemHealth status={status} />);
        expect(screen.getByText('Some systems need attention')).toBeInTheDocument();
        expect(screen.getByText('Calls may be delayed')).toBeInTheDocument();
        expect(screen.getByText('WARNING')).toBeInTheDocument();
    });

    it('renders down messages for PMS sync', () => {
        const status: SystemHealthStatus = {
            overall: 'down',
            telephony: 'healthy',
            pmsSync: 'down',
            aiEngine: 'healthy',
        };
        render(<SystemHealth status={status} />);
        expect(screen.getByText('System offline – contact support')).toBeInTheDocument();
        expect(screen.getByText('Sync offline')).toBeInTheDocument();
        expect(screen.getByText('CRITICAL')).toBeInTheDocument();
    });

    it('labels all subsystems with clinic-friendly names', () => {
        render(<SystemHealth />);
        expect(screen.getByText('Telephony')).toBeInTheDocument();
        expect(screen.getByText('AI Engine')).toBeInTheDocument();
        expect(screen.getByText('Clinic Software Sync')).toBeInTheDocument();
    });

    it('does NOT render any sci-fi labels', () => {
        const { container } = render(<SystemHealth />);
        const text = container.textContent || '';
        expect(text).not.toContain('System_Health_v4.5');
        expect(text).not.toContain('NOMINAL');
        expect(text).not.toContain('Primary_Node');
        expect(text).not.toContain('US-EAST-1');
        expect(text).not.toContain('NODE_ALPHA');
    });
});
