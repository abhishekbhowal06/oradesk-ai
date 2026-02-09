/**
 * CLINICAL CONSTRAINT ENGINE (The "Can We?")
 * 
 * Purpose: Physically block clinically unsafe or impossible appointments.
 * 
 * Logic Checks:
 * 1. Dose-Check: Pre-medication (antibiotics) requirements
 * 2. Resource-Check: Assistant/Room capabilities
 * 3. Fatigue-Check: Provider workload
 */

import { supabase } from '../supabase';
import { logger } from '../logger';

export interface ConstraintCheckRequest {
    patientId: string;
    procedureCode: string; // ADA Code
    targetSlot: {
        start: Date;
        end: Date;
        providerId: string;
        operatoryId: string;
    };
}

export interface ConstraintResult {
    status: 'SAFE' | 'UNSAFE' | 'REQUIRES_TRIAGE';
    violations: string[];
}

export class ClinicalConstraintEngine {

    /**
     * Verify if an appointment is medically and physically possible
     */
    async verify(request: ConstraintCheckRequest): Promise<ConstraintResult> {
        const violations: string[] = [];

        try {
            // 1. Fetch Patient Medical Flags
            const { data: patient } = await supabase
                .from('patients')
                .select('medical_history, active_medications, pre_med_required')
                .eq('id', request.patientId)
                .single();

            // Check Pre-Medication
            if (patient?.pre_med_required) {
                // For now, require human triage for pre-med patients to ensure they took it
                return {
                    status: 'REQUIRES_TRIAGE',
                    violations: ['Patient requires antibiotic pre-medication - Human verification required']
                };
            }

            // 2. Fetch Procedure Requirements
            // In a real system, this would query a 'procedures' table
            // simulating lookup for now
            const requiresAssistant = this.doesProcedureRequireAssistant(request.procedureCode);
            const requiresNitrous = this.doesProcedureRequireNitrous(request.procedureCode);

            // 3. Check Resource Availability
            if (requiresAssistant) {
                const assistantAvailable = await this.checkAssistantAvailability(request.targetSlot);
                if (!assistantAvailable) {
                    violations.push('No Dental Assistant available for this slot');
                }
            }

            // 4. Check Provider Fatigue
            const isFatigued = await this.checkProviderFatigue(request.targetSlot.providerId, request.targetSlot.start);
            if (isFatigued) {
                violations.push('Provider has exceeded high-strain procedure limit for the day');
            }

            if (violations.length > 0) {
                return { status: 'UNSAFE', violations };
            }

            return { status: 'SAFE', violations: [] };

        } catch (error) {
            logger.error('Error in ClinicalConstraintEngine', { error });
            // Fail safe
            return { status: 'REQUIRES_TRIAGE', violations: ['System error during constraint check'] };
        }
    }

    private doesProcedureRequireAssistant(code: string): boolean {
        // Mock logic - would be DB lookup
        const complexProcedures = ['D2740', 'D3330', 'D6010']; // Crowns, Root Canal, Implant
        return complexProcedures.some(p => code.includes(p));
    }

    private doesProcedureRequireNitrous(code: string): boolean {
        // Mock logic
        return false;
    }

    private async checkAssistantAvailability(slot: { start: Date, end: Date }): Promise<boolean> {
        // Mock: assume available for now, would query 'shift_schedules'
        return true;
    }

    private async checkProviderFatigue(providerId: string, date: Date): Promise<boolean> {
        // Mock: Check if >6 hours of production scheduled
        return false;
    }
}

export const clinicalConstraintEngine = new ClinicalConstraintEngine();
