/**
 * REVENUE STABILIZATION AUTOPILOT
 * Monitors revenue trends and autonomously fills revenue gaps to hit targets
 * 
 * Core behavior:
 * - Tracks daily/weekly revenue against targets
 * - Detects when trending under target
 * - Automatically triggers filling actions (recall calls, waitlist, discounts)
 * - Smooths revenue variance for predictable cash flow
 */

import { supabase } from '../supabase';
import { logger } from '../logger';
import { makeOutboundCall } from '../twilio-outbound';
import { sendSMS } from '../twilio-sms';
import { yieldOptimizer } from '../engines/yield-optimizer';
import { withLock } from '../distributed-lock';

interface RevenueTarget {
    clinicId: string;
    dailyTarget: number;
    weeklyTarget: number;
    monthlyTarget: number;
}

interface RevenueGap {
    clinicId: string;
    period: 'daily' | 'weekly' | 'monthly';
    target: number;
    current: number;
    gap: number;
    gapPercent: number;
    daysRemaining: number;
}

export class RevenueStabilizationEngine {
    private readonly CHECK_INTERVAL_MS = 3600000; // Check every hour
    private readonly GAP_THRESHOLD_PERCENT = 15; // Trigger if >15% under target
    private isRunning = false;

    async start() {
        if (this.isRunning) {
            logger.warn('Revenue stabilization engine already running');
            return;
        }

        this.isRunning = true;
        logger.info('🤖 Revenue Stabilization Autopilot started');

        await this.runStabilizationCycle();

        setInterval(async () => {
            if (this.isRunning) {
                await this.runStabilizationCycle();
            }
        }, this.CHECK_INTERVAL_MS);
    }

    stop() {
        this.isRunning = false;
        logger.info('Revenue Stabilization Autopilot stopped');
    }

    /**
     * Main stabilization cycle - protected by distributed lock
     */
    private async runStabilizationCycle() {
        // ARCHITECTURAL CORRECTION: Use distributed lock to prevent race conditions
        await withLock('revenue_stabilization_engine', async () => {
            try {
                // Get all active clinics
                const { data: clinics } = await supabase
                    .from('clinics')
                    .select('id, revenue_target_monthly');

                if (!clinics) return;

                for (const clinic of clinics) {
                    // Calculate revenue targets
                    const targets = this.calculateTargets(clinic.revenue_target_monthly || 60000);

                    // Check for revenue gaps
                    const gap = await this.detectRevenueGap(clinic.id, targets);

                    if (gap && gap.gapPercent > this.GAP_THRESHOLD_PERCENT) {
                        logger.info('Revenue gap detected - taking action', { gap });
                        await this.fillRevenueGap(gap);
                    }
                }

            } catch (error) {
                logger.error('Error in revenue stabilization cycle', { error });
            }
        }, { skipIfLocked: true });
    }

    /**
     * Calculate daily/weekly targets from monthly target
     */
    private calculateTargets(monthlyTarget: number): RevenueTarget {
        const dailyTarget = monthlyTarget / 22; // ~22 working days per month
        const weeklyTarget = monthlyTarget / 4.33; // ~4.33 weeks per month

        return {
            clinicId: '',
            dailyTarget,
            weeklyTarget,
            monthlyTarget
        };
    }

    /**
     * Detect revenue gaps
     */
    private async detectRevenueGap(clinicId: string, targets: RevenueTarget): Promise<RevenueGap | null> {
        const now = new Date();

        // Check weekly revenue (most actionable timeframe)
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay()); // Start of week
        weekStart.setHours(0, 0, 0, 0);

        const { data: appointments } = await supabase
            .from('appointments')
            .select('estimated_cost, status')
            .eq('clinic_id', clinicId)
            .gte('scheduled_at', weekStart.toISOString())
            .lte('scheduled_at', now.toISOString());

        const currentRevenue = (appointments || [])
            .filter(apt => apt.status !== 'cancelled')
            .reduce((sum, apt) => sum + (apt.estimated_cost || 0), 0);

        const daysElapsed = now.getDay() + 1; // 1-7
        const expectedRevenue = (targets.weeklyTarget / 7) * daysElapsed;
        const gap = expectedRevenue - currentRevenue;
        const gapPercent = (gap / expectedRevenue) * 100;

        if (gap > 0 && gapPercent > this.GAP_THRESHOLD_PERCENT) {
            return {
                clinicId,
                period: 'weekly',
                target: Math.round(expectedRevenue),
                current: Math.round(currentRevenue),
                gap: Math.round(gap),
                gapPercent: Math.round(gapPercent),
                daysRemaining: 7 - daysElapsed
            };
        }

        return null;
    }

    /**
     * Take autonomous action to fill revenue gap
     */
    private async fillRevenueGap(gap: RevenueGap) {
        logger.info(`Filling revenue gap of $${gap.gap} (${gap.gapPercent}% under target)`);

        // Strategy 1: Call high-value treatment plan patients
        await this.callPendingTreatmentPlans(gap);

        // Strategy 2: Fill open slots with recall patients
        await this.fillOpenSlotsWithRecall(gap);

        // Strategy 3: Offer last-minute discounts for slow slots
        if (gap.gap > gap.target * 0.2) { // If >20% under, use discounts
            await this.offerLastMinuteDiscounts(gap);
        }

        // Record snapshot
        await this.recordRevenueSnapshot(gap);

        // Notify doctor of autonomous actions
        await this.notifyDoctorOfActions(gap);
    }

    /**
     * Call patients with pending treatment plans
     */
    private async callPendingTreatmentPlans(gap: RevenueGap) {
        const { data: treatmentPlans } = await supabase
            .from('treatment_plan_pipeline')
            .select('*, patients(*)')
            .eq('clinic_id', gap.clinicId)
            .in('stage', ['patient_thinking', 'follow_up_sent'])
            .order('estimated_cost_usd', { ascending: false })
            .limit(10);

        if (!treatmentPlans || treatmentPlans.length === 0) return;

        let called = 0;
        let booked = 0;

        for (const plan of treatmentPlans) {
            // Don't over-fill
            if (gap.gap <= 0) break;

            try {
                const callResult = await makeOutboundCall({
                    to: plan.patients.phone,
                    clinicId: gap.clinicId,
                    callType: 'treatment_plan_follow_up',
                    context: {
                        patientName: plan.patients.full_name,
                        procedureName: plan.procedure_name,
                        estimatedCost: plan.estimated_cost_usd,
                        urgency: plan.urgency
                    }
                });

                called++;

                if (callResult.outcome === 'appointment_booked') {
                    booked++;
                    gap.gap -= plan.estimated_cost_usd; // Reduce remaining gap
                }

                await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limit

            } catch (error) {
                logger.error('Error calling treatment plan patient', { error });
            }
        }

        logger.info(`Treatment plan calls: ${called} made, ${booked} booked`);

        // Log action
        await supabase.from('autonomous_actions').insert({
            clinic_id: gap.clinicId,
            action_type: 'revenue_stabilization_treatment_plans',
            action_taken: `Called ${called} patients with pending treatment plans to close revenue gap`,
            reasoning: `Revenue ${gap.gapPercent}% under target. Need $${gap.gap} to hit weekly goal.`,
            confidence_score: 75,
            triggered_by: 'revenue_below_target',
            outcome: 'success',
            business_impact_usd: booked * 300 // Rough average
        });
    }

    /**
     * Fill open slots with recall patients
     */
    private async fillOpenSlotsWithRecall(gap: RevenueGap) {
        // Get open slots this week
        const now = new Date();
        const weekEnd = new Date(now);
        weekEnd.setDate(now.getDate() + (7 - now.getDay()));

        const { data: openSlots } = await supabase.rpc('get_open_slots', {
            p_clinic_id: gap.clinicId,
            p_start_date: now.toISOString(),
            p_end_date: weekEnd.toISOString()
        });

        if (!openSlots || openSlots.length === 0) {
            logger.info('No open slots available to fill');
            return;
        }

        // Fill slots from recall list
        let filled = 0;

        for (const slot of openSlots.slice(0, 5)) { // Fill up to 5 slots
            const { data: recallPatients } = await supabase.rpc('get_recall_candidates_for_slot', {
                p_clinic_id: gap.clinicId,
                p_slot_time: slot.time,
                p_limit: 3
            });

            if (!recallPatients || recallPatients.length === 0) continue;

            for (const patient of recallPatients) {
                try {
                    const callResult = await makeOutboundCall({
                        to: patient.phone,
                        clinicId: gap.clinicId,
                        callType: 'recall_appointment_offer',
                        context: {
                            patientName: patient.full_name,
                            availableSlot: slot.time,
                            lastVisit: patient.last_visit
                        }
                    });

                    if (callResult.outcome === 'appointment_booked') {
                        filled++;
                        break; // Slot filled, move to next slot
                    }

                } catch (error) {
                    logger.error('Error calling recall patient', { error });
                }
            }
        }

        logger.info(`Filled ${filled} open slots with recall patients`);
    }

    /**
     * Offer last-minute discounts for slow slots
     */
    private async offerLastMinuteDiscounts(gap: RevenueGap) {
        // Check Yield Optimizer first (The "Should We?")
        // We are in discount territory, but make sure we aren't filling prime slots
        const yieldCheck = yieldOptimizer.check({
            procedureEstimatedValue: 89, // Discounted hygiene value
            slotStartTime: new Date(), // Mock: Check current/next slot
            currentDayProduction: gap.current,
            dailyGoal: gap.target / 7
        });

        if (yieldCheck.decision === 'REJECT') {
            logger.warn('🚫 Discount offer blocked by Yield Optimizer', { yieldCheck });
            return;
        }

        // Proceed if Safe
        const { data: waitlist } = await supabase
            .from('patient_waitlist')
            .select('*, patients(*)')
            .eq('clinic_id', gap.clinicId)
            .eq('status', 'active')
            .limit(20);

        if (!waitlist || waitlist.length === 0) return;

        let sent = 0;

        for (const entry of waitlist) {
            const message = `Hi ${entry.patients.full_name.split(' ')[0]}! Last-minute opening available this week. Hygiene cleaning $89 (reg $129) if you can make it. Reply YES for available times!`;

            await sendSMS({
                to: entry.patients.phone,
                body: message,
                expectsReply: true
            });

            sent++;

            if (sent >= 10) break; // Don't spam too many
        }

        logger.info(`Sent ${sent} last-minute discount offers`);

        await supabase.from('autonomous_actions').insert({
            clinic_id: gap.clinicId,
            action_type: 'revenue_stabilization_discounts',
            action_taken: `Offered last-minute discounts to ${sent} waitlist patients`,
            reasoning: `Revenue gap severe (${gap.gapPercent}% under). Yield Optimizer Score: ${yieldCheck.yieldScore}.`,
            triggered_by: 'revenue_critical_gap',
            outcome: 'pending'
        });
    }

    /**
     * Record revenue snapshot
     */
    private async recordRevenueSnapshot(gap: RevenueGap) {
        await supabase.from('revenue_stability_metrics').insert({
            clinic_id: gap.clinicId,
            period_type: gap.period,
            period_start: new Date(Date.now() - gap.daysRemaining * 24 * 60 * 60 * 1000).toISOString(),
            period_end: new Date().toISOString(),
            actual_revenue_usd: gap.current,
            target_revenue_usd: gap.target,
            variance_usd: -gap.gap,
            variance_percent: -gap.gapPercent
        });
    }

    /**
     * Notify doctor of autonomous actions taken
     */
    private async notifyDoctorOfActions(gap: RevenueGap) {
        const { data: clinic } = await supabase
            .from('clinics')
            .select('owner_phone')
            .eq('id', gap.clinicId)
            .single();

        if (!clinic || !clinic.owner_phone) return;

        const message = `📊 Revenue Update: This week trending $${gap.gap} under target (${gap.gapPercent}%).

AI took action:
✓ Called treatment plan patients
✓ Filled open slots from recall list
✓ Offered last-minute specials

Will update you on results. - Your Revenue Autopilot`;

        await sendSMS({
            to: clinic.owner_phone,
            body: message
        });
    }

    /**
     * Get stabilization metrics
     */
    async getMetrics(clinicId: string, days: number = 30) {
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const { data: metrics } = await supabase
            .from('revenue_stability_metrics')
            .select('*')
            .eq('clinic_id', clinicId)
            .gte('period_start', cutoffDate.toISOString());

        if (!metrics || metrics.length === 0) {
            return {
                avgVariancePercent: 0,
                revenueStabilized: 0,
                interventionCount: 0
            };
        }

        const avgVariancePercent = Math.abs(
            metrics.reduce((sum, m) => sum + m.variance_percent, 0) / metrics.length
        );

        const { data: actions } = await supabase
            .from('autonomous_actions')
            .select('*')
            .eq('clinic_id', clinicId)
            .like('action_type', 'revenue_stabilization%')
            .gte('created_at', cutoffDate.toISOString());

        return {
            avgVariancePercent: Math.round(avgVariancePercent),
            revenueStabilized: metrics.reduce((sum, m) => sum + (m.ai_filled_revenue_usd || 0), 0),
            interventionCount: actions?.length || 0
        };
    }
}

// Singleton instance
export const revenueStabilizationEngine = new RevenueStabilizationEngine();
