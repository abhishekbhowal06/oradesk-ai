/**
 * NO-SHOW PREDICTION ENGINE
 * Predicts which patients are likely to no-show and takes preemptive action
 * 
 * Core behavior:
 * - Analyzes patient behavioral patterns
 * - Calculates no-show probability for each appointment
 * - Sends targeted engagement to high-risk patients
 * - Activates waitlist for predicted no-shows
 */

import { supabase } from '../supabase';
import { logger } from '../logger';
import { sendSMS } from '../twilio-sms';
import { withLock } from '../distributed-lock';

interface AppointmentRiskAssessment {
    appointmentId: string;
    patientId: string;
    patientName: string;
    patientPhone: string;
    scheduledAt: Date;
    noShowProbability: number;
    riskFactors: string[];
    reliabilityScore: number;
}

export class NoShowPredictionEngine {
    private readonly CHECK_INTERVAL_MS = 300000; // Check every 5 minutes
    private readonly HIGH_RISK_THRESHOLD = 60; // >60% probability = high risk
    private isRunning = false;

    /**
     * Start the prediction engine
     */
    async start() {
        if (this.isRunning) {
            logger.warn('No-show prediction engine already running');
            return;
        }

        this.isRunning = true;
        logger.info('🤖 No-Show Prediction Engine started');

        // Initial run
        await this.runPredictionCycle();

        // Continuous monitoring
        setInterval(async () => {
            if (this.isRunning) {
                await this.runPredictionCycle();
            }
        }, this.CHECK_INTERVAL_MS);
    }

    stop() {
        this.isRunning = false;
        logger.info('No-Show Prediction Engine stopped');
    }

    /**
     * Main prediction cycle - protected by distributed lock
     */
    private async runPredictionCycle() {
        // ARCHITECTURAL CORRECTION: Use distributed lock to prevent race conditions
        await withLock('no_show_prediction_engine', async () => {
            try {
                // Get appointments in next 7 days
                const upcomingAppointments = await this.getUpcomingAppointments();

                for (const appointment of upcomingAppointments) {
                    // Calculate no-show risk
                    const risk = await this.assessNoShowRisk(appointment);

                    if (risk.noShowProbability >= this.HIGH_RISK_THRESHOLD) {
                        // High risk - take preemptive action
                        await this.preventNoShow(risk);
                    }
                }

            } catch (error) {
                logger.error('Error in no-show prediction cycle', { error });
            }
        }, { skipIfLocked: true });
    }

    /**
     * Get upcoming appointments
     */
    private async getUpcomingAppointments() {
        const now = new Date();
        const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        const { data: appointments, error } = await supabase
            .from('appointments')
            .select(`
                id,
                clinic_id,
                patient_id,
                scheduled_at,
                patients!inner (
                    id,
                    full_name,
                    phone
                )
            `)
            .eq('status', 'scheduled')
            .gte('scheduled_at', now.toISOString())
            .lte('scheduled_at', sevenDaysOut.toISOString());

        if (error) {
            logger.error('Error fetching upcoming appointments', { error });
            return [];
        }

        return appointments || [];
    }

    /**
     * Assess no-show risk for an appointment
     */
    private async assessNoShowRisk(appointment: any): Promise<AppointmentRiskAssessment> {
        const { data: profile } = await supabase
            .from('patient_behavioral_profiles')
            .select('*')
            .eq('patient_id', appointment.patient_id)
            .single();

        const riskFactors: string[] = [];
        let noShowProbability = 0;

        if (!profile) {
            //New patient - moderate risk
            noShowProbability = 40;
            riskFactors.push('new_patient_no_history');
        } else {
            // Calculate based on historical patterns
            const baseRisk = 100 - (profile.reliability_score || 50);
            noShowProbability = baseRisk;

            if (profile.no_show_count > 2) {
                riskFactors.push(`${profile.no_show_count}_previous_no_shows`);
                noShowProbability += 20;
            }

            if (profile.last_minute_cancellations > 1) {
                riskFactors.push('history_of_last_minute_cancellations');
                noShowProbability += 10;
            }

            if (!profile.avg_confirmation_response_time_hours || profile.avg_confirmation_response_time_hours > 24) {
                riskFactors.push('slow_to_confirm');
                noShowProbability += 15;
            }

            if (profile.has_outstanding_balance) {
                riskFactors.push('outstanding_balance');
                noShowProbability += 10;
            }

            // Time-based risk factors
            const appointmentDate = new Date(appointment.scheduled_at);
            const daysUntilAppointment = Math.floor((appointmentDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

            if (daysUntilAppointment > 14) {
                riskFactors.push('booked_far_in_advance');
                noShowProbability += 10;
            }

            // First appointment of day risk
            const hour = appointmentDate.getHours();
            if (hour === 8 || hour === 9) {
                riskFactors.push('first_appointment_of_day');
                noShowProbability += 8;
            }

            // Monday risk (higher no-show rate statistically)
            if (appointmentDate.getDay() === 1) {
                riskFactors.push('monday_appointment');
                noShowProbability += 5;
            }
        }

        // Cap at 100%
        noShowProbability = Math.min(noShowProbability, 100);

        return {
            appointmentId: appointment.id,
            patientId: appointment.patient_id,
            patientName: appointment.patients.full_name,
            patientPhone: appointment.patients.phone,
            scheduledAt: new Date(appointment.scheduled_at),
            noShowProbability,
            riskFactors,
            reliabilityScore: profile?.reliability_score || 50
        };
    }

    /**
     * Take preemptive action to prevent no-show
     */
    private async preventNoShow(risk: AppointmentRiskAssessment) {
        logger.info('High no-show risk detected - taking preemptive action', {
            patient: risk.patientName,
            probability: risk.noShowProbability,
            factors: risk.riskFactors
        });

        // Determine intervention strategy based on days until appointment
        const daysUntil = Math.floor((risk.scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        if (daysUntil >= 3) {
            // Early engagement - personalized text
            await this.sendEngagementText(risk);
        }

        if (daysUntil === 1) {
            // Day before - confirmation required
            await this.sendFirmConfirmation(risk);
        }

        // Log the intervention
        await this.logPrediction(risk);
    }

    /**
     * Send engagement text to increase commitment
     */
    private async sendEngagementText(risk: AppointmentRiskAssessment) {
        const message = `Hi ${risk.patientName.split(' ')[0]}! Excited to see you ${risk.scheduledAt.toLocaleDateString()} at ${risk.scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Quick question: Do morning or afternoon appointments work better for you long-term? This helps us serve you better! 😊`;

        await sendSMS({
            to: risk.patientPhone,
            body: message,
            trackEngagement: true
        });

        // Update intervention tracking
        await supabase.from('autonomous_actions').insert({
            patient_id: risk.patientId,
            appointment_id: risk.appointmentId,
            action_type: 'no_show_prevention_engagement',
            action_taken: 'Sent personalized engagement text to increase commitment',
            reasoning: `Patient has ${risk.noShowProbability}% no-show probability. Risk factors: ${risk.riskFactors.join(', ')}`,
            confidence_score: risk.noShowProbability,
            triggered_by: 'high_no_show_risk_detected',
            trigger_data: {
                no_show_probability: risk.noShowProbability,
                risk_factors: risk.riskFactors
            }
        });
    }

    /**
     * Send firm confirmation with waitlist threat
     */
    private async sendFirmConfirmation(risk: AppointmentRiskAssessment) {
        const message = `Hi ${risk.patientName.split(' ')[0]}, your appointment is tomorrow at ${risk.scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Reply YES to confirm, or we'll release your spot to our waitlist. Thanks!`;

        await sendSMS({
            to: risk.patientPhone,
            body: message,
            expectsReply: true,
            appointmentId: risk.appointmentId
        });

        await supabase.from('autonomous_actions').insert({
            patient_id: risk.patientId,
            appointment_id: risk.appointmentId,
            action_type: 'no_show_prevention_firm_confirm',
            action_taken: 'Sent firm confirmation with waitlist deadline',
            reasoning: `24 hours before appointment, ${risk.noShowProbability}% no-show risk`,
            confidence_score: risk.noShowProbability,
            triggered_by: 'day_before_high_risk'
        });
    }

    /**
     * Log prediction for model improvement
     */
    private async logPrediction(risk: AppointmentRiskAssessment) {
        // Store prediction - we'll compare to actual outcome later
        await supabase.from('no_show_predictions').insert({
            appointment_id: risk.appointmentId,
            patient_id: risk.patientId,
            predicted_probability: risk.noShowProbability,
            risk_factors: risk.riskFactors,
            prediction_made_at: new Date().toISOString(),
            days_before_appointment: Math.floor((risk.scheduledAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        });
    }

    /**
     * Post-appointment learning - compare prediction to reality
     */
    async updatePredictionAccuracy(appointmentId: string, actualOutcome: 'completed' | 'no_show') {
        const { data: prediction } = await supabase
            .from('no_show_predictions')
            .select('*')
            .eq('appointment_id', appointmentId)
            .single();

        if (!prediction) return;

        const wasCorrect = (
            (actualOutcome === 'no_show' && prediction.predicted_probability >= 60) ||
            (actualOutcome === 'completed' && prediction.predicted_probability < 60)
        );

        await supabase
            .from('no_show_predictions')
            .update({
                actual_outcome: actualOutcome,
                prediction_correct: wasCorrect,
                outcome_recorded_at: new Date().toISOString()
            })
            .eq('appointment_id', appointmentId);

        // Update patient behavioral profile
        if (actualOutcome === 'no_show') {
            await supabase.rpc('update_patient_reliability_score', {
                p_patient_id: prediction.patient_id,
                p_action: 'no_show',
                p_score_delta: -15
            });
        } else {
            await supabase.rpc('update_patient_reliability_score', {
                p_patient_id: prediction.patient_id,
                p_action: 'showed_up',
                p_score_delta: 5
            });
        }

        logger.info('Updated no-show prediction accuracy', {
            appointmentId,
            predicted: prediction.predicted_probability,
            actual: actualOutcome,
            correct: wasCorrect
        });
    }

    /**
     * Get prediction accuracy metrics
     */
    async getAccuracyMetrics(clinicId: string, days: number = 30) {
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const { data: predictions } = await supabase
            .from('no_show_predictions')
            .select('predicted_probability, actual_outcome, prediction_correct')
            .gte('prediction_made_at', cutoffDate.toISOString())
            .not('actual_outcome', 'is', null);

        if (!predictions || predictions.length === 0) {
            return {
                totalPredictions: 0,
                accuracy: 0,
                precision: 0,
                recall: 0
            };
        }

        const totalPredictions = predictions.length;
        const correctPredictions = predictions.filter(p => p.prediction_correct).length;
        const accuracy = (correctPredictions / totalPredictions) * 100;

        const predictedNoShows = predictions.filter(p => p.predicted_probability >= 60);
        const actualNoShows = predictions.filter(p => p.actual_outcome === 'no_show');
        const truePositives = predictions.filter(p =>
            p.predicted_probability >= 60 && p.actual_outcome === 'no_show'
        ).length;

        const precision = predictedNoShows.length > 0 ? (truePositives / predictedNoShows.length) * 100 : 0;
        const recall = actualNoShows.length > 0 ? (truePositives / actualNoShows.length) * 100 : 0;

        return {
            totalPredictions,
            accuracy,
            precision,
            recall
        };
    }
}

// Singleton instance
export const noShowPredictionEngine = new NoShowPredictionEngine();
