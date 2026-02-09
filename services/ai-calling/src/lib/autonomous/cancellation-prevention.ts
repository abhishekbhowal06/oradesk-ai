/**
 * CANCELLATION PREVENTION ENGINE
 * Autonomous system that detects schedule gaps and fills them proactively
 * 
 * Core behavior:
 * - Monitors schedule in real-time
 * - Detects cancellations immediately
 * - Automatically fills gaps from recall list
 * - Optimizes for revenue and schedule density
 */

import { supabase } from '../supabase';
import { logger } from '../logger';
import { makeOutboundCall } from '../twilio-outbound';
import { clinicalConstraintEngine } from '../engines/clinical-constraints';
import { yieldOptimizer } from '../engines/yield-optimizer';

interface ScheduleGap {
    appointmentId: string;
    clinicId: string;
    scheduledAt: Date;
    estimatedRevenue: number;
    slotDuration: number;
}

interface RecallCandidate {
    patientId: string;
    patientPhone: string;
    patientName: string;
    lastVisit: Date;
    procedureNeeded: string;
    estimatedRevenue: number;
    reliabilityScore: number;
    flexible: boolean;
}

import { withLock } from '../distributed-lock';

export class CancellationPreventionEngine {
    private readonly CHECK_INTERVAL_MS = 60000; // Check every minute
    private isRunning = false;

    /**
     * Start the autonomous engine
     */
    async start() {
        if (this.isRunning) {
            logger.warn('Cancellation prevention engine already running');
            return;
        }

        this.isRunning = true;
        logger.info('🤖 Cancellation Prevention Engine started');

        // Initial run
        await this.runPreventionCycle();

        // Continuous monitoring
        setInterval(async () => {
            if (this.isRunning) {
                await this.runPreventionCycle();
            }
        }, this.CHECK_INTERVAL_MS);
    }

    /**
     * Stop the engine
     */
    stop() {
        this.isRunning = false;
        logger.info('Cancellation Prevention Engine stopped');
    }

    /**
     * Main prevention cycle - now protected by distributed lock
     */
    private async runPreventionCycle() {
        // ARCHITECTURAL CORRECTION: Use distributed lock to prevent race conditions
        // Only one server instance can run this cycle at a time
        await withLock('cancellation_prevention_engine', async () => {
            try {
                // 1. Detect schedule gaps from recent cancellations
                const gaps = await this.detectScheduleGaps();

                if (gaps.length === 0) {
                    return; // No gaps to fill
                }

                logger.info(`Detected ${gaps.length} schedule gaps`, { gaps });

                // 2. For each gap, find best recall candidates
                for (const gap of gaps) {
                    await this.fillScheduleGap(gap);
                }

            } catch (error) {
                logger.error('Error in cancellation prevention cycle', { error });
            }
        }, { skipIfLocked: true });
    }


    /**
     * Detect recent cancellations creating schedule gaps
     */
    private async detectScheduleGaps(): Promise<ScheduleGap[]> {
        const { data: cancelledAppointments, error } = await supabase
            .from('appointments')
            .select('id, clinic_id, scheduled_at, estimated_cost, duration_minutes')
            .eq('status', 'cancelled')
            .gte('scheduled_at', new Date().toISOString()) // Future appointments only
            .gte('cancelled_at', new Date(Date.now() - 3600000).toISOString()) // Cancelled in last hour
            .order('scheduled_at', { ascending: true });

        if (error) {
            logger.error('Error fetching cancelled appointments', { error });
            return [];
        }

        return (cancelledAppointments || []).map(apt => ({
            appointmentId: apt.id,
            clinicId: apt.clinic_id,
            scheduledAt: new Date(apt.scheduled_at),
            estimatedRevenue: apt.estimated_cost || 0,
            slotDuration: apt.duration_minutes || 60
        }));
    }

    /**
     * Fill a specific schedule gap
     */
    private async fillScheduleGap(gap: ScheduleGap) {
        // Find best recall candidates for this slot
        const candidates = await this.findRecallCandidates(gap);

        if (candidates.length === 0) {
            logger.info('No suitable recall candidates found for gap', { gap });
            return;
        }

        // Try candidates in order of priority (reliability score + revenue potential)
        for (const candidate of candidates) {
            const success = await this.attemptToBookCandidate(gap, candidate);

            if (success) {
                logger.info('✅ Successfully filled schedule gap', {
                    gapTime: gap.scheduledAt,
                    patient: candidate.patientName,
                    revenue: gap.estimatedRevenue
                });

                // Log autonomous action
                await this.logAutonomousAction({
                    action: 'cancellation_fill',
                    gap,
                    candidate,
                    outcome: 'success'
                });

                break; // Gap filled, move to next gap
            }
        }
    }

    /**
     * Find recall candidates suitable for this time slot
     */
    private async findRecallCandidates(gap: ScheduleGap): Promise<RecallCandidate[]> {
        // Query patients who:
        // 1. Are due for recall (last visit > 6 months ago)
        // 2. Belong to this clinic
        // 3. Have high reliability score
        // 4. Are marked as flexible schedule

        const { data: recallPatients, error } = await supabase.rpc('get_recall_candidates_for_slot', {
            p_clinic_id: gap.clinicId,
            p_slot_time: gap.scheduledAt.toISOString(),
            p_limit: 10
        });

        if (error) {
            logger.error('Error fetching recall candidates', { error });
            return [];
        }

        return (recallPatients || []).map((p: any) => ({
            patientId: p.patient_id,
            patientPhone: p.phone,
            patientName: p.full_name,
            lastVisit: new Date(p.last_visit),
            procedureNeeded: p.procedure_needed || 'routine cleaning',
            estimatedRevenue: p.estimated_revenue || 129,
            reliabilityScore: p.reliability_score || 50,
            flexible: p.flexible_schedule || false
        }));
    }

    /**
     * Attempt to book a recall candidate into the gap
     */
    private async attemptToBookCandidate(gap: ScheduleGap, candidate: RecallCandidate): Promise<boolean> {

        // 1. Check Clinical Constraints (The "Can We?")
        const constraintCheck = await clinicalConstraintEngine.verify({
            patientId: candidate.patientId,
            procedureCode: 'D1110', // Default prophy code for recall
            targetSlot: {
                start: gap.scheduledAt,
                end: new Date(gap.scheduledAt.getTime() + gap.slotDuration * 60000),
                providerId: 'provider-1', // Mock provider ID
                operatoryId: 'op-1'       // Mock operatory ID
            }
        });

        if (constraintCheck.status !== 'SAFE') {
            logger.warn('🚫 Booking blocked by Clinical Constraints', { constraintCheck });
            return false;
        }

        // 2. Check Yield Optimization (The "Should We?")
        const yieldCheck = yieldOptimizer.check({
            procedureEstimatedValue: candidate.estimatedRevenue,
            slotStartTime: gap.scheduledAt,
            currentDayProduction: 2500, // Mock current day production
            dailyGoal: 5000            // Mock daily goal
        });

        if (yieldCheck.decision === 'REJECT' || yieldCheck.decision === 'HOLD_FOR_BETTER') {
            logger.info('🚫 Booking blocked by Yield Optimizer', { yieldCheck });
            return false;
        }

        try {
            // Make outbound AI call
            const callResult = await makeOutboundCall({
                to: candidate.patientPhone,
                clinicId: gap.clinicId,
                callType: 'recall_appointment_offer',
                context: {
                    patientName: candidate.patientName,
                    procedureNeeded: candidate.procedureNeeded,
                    availableSlot: gap.scheduledAt.toISOString(),
                    lastVisit: candidate.lastVisit.toISOString(),
                    urgency: 'fill_cancellation'
                }
            });

            // If patient confirms, book appointment
            if (callResult.outcome === 'appointment_booked') {
                // Create appointment
                const { error: bookError } = await supabase
                    .from('appointments')
                    .insert({
                        clinic_id: gap.clinicId,
                        patient_id: candidate.patientId,
                        scheduled_at: gap.scheduledAt,
                        duration_minutes: gap.slotDuration,
                        procedure_name: candidate.procedureNeeded,
                        estimated_cost: candidate.estimatedRevenue,
                        status: 'scheduled',
                        booking_source: 'ai_cancellation_fill'
                    });

                if (bookError) {
                    logger.error('Error creating filled appointment', { bookError });
                    return false;
                }

                // Update patient behavioral profile (successful booking = good reliability signal)
                await supabase.rpc('update_patient_reliability_score', {
                    p_patient_id: candidate.patientId,
                    p_action: 'accepted_recall_offer',
                    p_score_delta: 5
                });

                return true;
            }

            return false;

        } catch (error) {
            logger.error('Error attempting to book candidate', { error, candidate });
            return false;
        }
    }

    /**
     * Log autonomous action for transparency and learning
     */
    private async logAutonomousAction(details: {
        action: string;
        gap: ScheduleGap;
        candidate: RecallCandidate;
        outcome: string;
    }) {
        await supabase.from('autonomous_actions').insert({
            clinic_id: details.gap.clinicId,
            patient_id: details.candidate.patientId,
            action_type: 'cancellation_prevention',
            action_taken: `Called ${details.candidate.patientName} to fill ${details.gap.scheduledAt.toLocaleString()} cancellation slot`,
            reasoning: `Detected cancellation creating $${details.gap.estimatedRevenue} revenue gap. Patient reliability score: ${details.candidate.reliabilityScore}. Last visit: ${details.candidate.lastVisit.toLocaleDateString()}`,
            confidence_score: details.candidate.reliabilityScore,
            triggered_by: 'cancellation_detected',
            trigger_data: {
                cancelled_appointment_id: details.gap.appointmentId,
                gap_time: details.gap.scheduledAt,
                revenue_at_risk: details.gap.estimatedRevenue
            },
            outcome: details.outcome,
            business_impact_usd: details.outcome === 'success' ? details.gap.estimatedRevenue : 0
        });
    }

    /**
     * Get performance metrics
     */
    async getMetrics(clinicId: string, days: number = 7): Promise<{
        totalGapsDetected: number;
        totalGapsFilled: number;
        fillRate: number;
        revenueRecovered: number;
    }> {
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const { data: actions } = await supabase
            .from('autonomous_actions')
            .select('outcome, business_impact_usd')
            .eq('clinic_id', clinicId)
            .eq('action_type', 'cancellation_prevention')
            .gte('created_at', cutoffDate.toISOString());

        const totalGapsDetected = actions?.length || 0;
        const totalGapsFilled = actions?.filter(a => a.outcome === 'success').length || 0;
        const revenueRecovered = actions?.reduce((sum, a) => sum + (a.business_impact_usd || 0), 0) || 0;

        return {
            totalGapsDetected,
            totalGapsFilled,
            fillRate: totalGapsDetected > 0 ? (totalGapsFilled / totalGapsDetected) * 100 : 0,
            revenueRecovered
        };
    }
}

// Singleton instance
export const cancellationPreventionEngine = new CancellationPreventionEngine();
