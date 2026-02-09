/**
 * REPUTATION SHIELD ENGINE
 * Crisis prevention system that detects and defuses patient frustration in real-time
 * 
 * Core behavior:
 * - Analyzes call sentiment and voice patterns
 * - Detects anger, frustration, confusion
 * - Auto-escalates to prevent negative reviews
 * - Saves doctor relationships before damage occurs
 */

import { supabase } from '../supabase';
import { logger } from '../logger';
import { sendSMS } from '../twilio-sms';
import { escalationRouter } from '../engines/escalation-router';

interface CrisisDetection {
    callId: string;
    patientId: string;
    patientName: string;
    patientPhone: string;
    clinicId: string;
    crisisType: 'angry_patient' | 'long_wait' | 'billing_dispute' | 'medical_concern';
    severity: 'low' | 'medium' | 'high' | 'critical';
    angerScore: number;
    negativeKeywords: string[];
    threatToLeave: boolean;
    reviewRiskScore: number;
}

export class ReputationShieldEngine {
    private readonly ANGER_THRESHOLD = 60; // 0-100 scale
    private readonly REVIEW_RISK_THRESHOLD = 70;

    /**
     * Analyze ongoing call for crisis signals
     */
    async analyzeCallInRealTime(callId: string, transcript: string, voiceMetrics: {
        pitch?: number;
        amplitude?: number;
        speakingRate?: number;
    }): Promise<CrisisDetection | null> {
        // Get call context
        const { data: call } = await supabase
            .from('ai_calls')
            .select('*, patients(*)')
            .eq('id', callId)
            .single();

        if (!call) return null;

        // Detect anger signals
        const angerScore = this.calculateAngerScore(transcript, voiceMetrics);
        const negativeKeywords = this.extractNegativeKeywords(transcript);
        const threatToLeave = this.detectThreatToLeave(transcript);

        // Determine crisis type and severity
        const crisisType = this.determineCrisisType(transcript, negativeKeywords);
        const severity = this.calculateSeverity(angerScore, threatToLeave, negativeKeywords.length);
        const reviewRiskScore = this.calculateReviewRisk(angerScore, threatToLeave, call.patients);

        // Only trigger if significant risk
        if (angerScore < this.ANGER_THRESHOLD && !threatToLeave) {
            return null; // Normal call, no crisis
        }

        const crisis: CrisisDetection = {
            callId,
            patientId: call.patient_id,
            patientName: call.patients.full_name,
            patientPhone: call.patients.phone,
            clinicId: call.clinic_id,
            crisisType,
            severity,
            angerScore,
            negativeKeywords,
            threatToLeave,
            reviewRiskScore
        };

        // Take immediate action
        await this.respondToCrisis(crisis);

        return crisis;
    }

    /**
     * Calculate anger score from transcript and voice
     */
    private calculateAngerScore(transcript: string, voiceMetrics: any): number {
        let score = 0;

        // Keyword-based anger detection
        const angryPhrases = [
            'unacceptable', 'ridiculous', 'waiting forever', 'terrible service',
            'never coming back', 'speak to manager', 'complaint', 'furious',
            'waste of time', 'incompetent', 'done with you', 'cancel everything'
        ];

        const transcriptLower = transcript.toLowerCase();
        angryPhrases.forEach(phrase => {
            if (transcriptLower.includes(phrase)) {
                score += 15;
            }
        });

        // Repetition indicates frustration
        if (transcriptLower.includes('i already told you') || transcriptLower.includes('i said')) {
            score += 20;
        }

        // Voice metrics (if available from Deepgram or speech analysis)
        if (voiceMetrics.pitch && voiceMetrics.pitch > 250) { // Higher pitch = stress
            score += 10;
        }

        if (voiceMetrics.speakingRate && voiceMetrics.speakingRate > 200) { // Fast talking = anger
            score += 10;
        }

        return Math.min(score, 100);
    }

    /**
     * Extract negative keywords
     */
    private extractNegativeKeywords(transcript: string): string[] {
        const negativeKeywords = [
            'terrible', 'awful', 'horrible', 'worst', 'unacceptable',
            'frustrated', 'angry', 'upset', 'disappointed', 'ridiculous',
            'waste', 'incompetent', 'unprofessional', 'rude'
        ];

        const transcriptLower = transcript.toLowerCase();
        return negativeKeywords.filter(keyword => transcriptLower.includes(keyword));
    }

    /**
     * Detect if patient threatens to leave
     */
    private detectThreatToLeave(transcript: string): boolean {
        const threatPhrases = [
            'never coming back',
            'find another dentist',
            'going elsewhere',
            'cancel all appointments',
            'done with you',
            'leaving a review',
            'contacting better business bureau'
        ];

        const transcriptLower = transcript.toLowerCase();
        return threatPhrases.some(phrase => transcriptLower.includes(phrase));
    }

    /**
     * Determine type of crisis
     */
    private determineCrisisType(transcript: string, negativeKeywords: string[]): CrisisDetection['crisisType'] {
        const transcriptLower = transcript.toLowerCase();

        if (transcriptLower.includes('billing') || transcriptLower.includes('charge') || transcriptLower.includes('payment')) {
            return 'billing_dispute';
        }

        if (transcriptLower.includes('waiting') || transcriptLower.includes('hold') || transcriptLower.includes('late')) {
            return 'long_wait';
        }

        if (transcriptLower.includes('pain') || transcriptLower.includes('emergency') || transcriptLower.includes('hurts')) {
            return 'medical_concern';
        }

        return 'angry_patient';
    }

    /**
     * Calculate crisis severity
     */
    private calculateSeverity(angerScore: number, threatToLeave: boolean, negativeKeywordCount: number): CrisisDetection['severity'] {
        if (threatToLeave || angerScore > 85) return 'critical';
        if (angerScore > 70 || negativeKeywordCount > 3) return 'high';
        if (angerScore > 60 || negativeKeywordCount > 1) return 'medium';
        return 'low';
    }

    /**
     * Calculate review risk score
     */
    private calculateReviewRisk(angerScore: number, threatToLeave: boolean, patient: any): number {
        let risk = angerScore;

        if (threatToLeave) risk += 20;

        // Long-term patients more likely to leave reviews
        if (patient.created_at && new Date(patient.created_at) < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)) {
            risk += 10; // Been with clinic over a year
        }

        return Math.min(risk, 100);
    }

    /**
     * Respond to detected crisis
     */
    private async respondToCrisis(crisis: CrisisDetection) {
        logger.warn('🚨 REPUTATION CRISIS DETECTED', {
            patient: crisis.patientName,
            severity: crisis.severity,
            type: crisis.crisisType,
            angerScore: crisis.angerScore,
            reviewRisk: crisis.reviewRiskScore
        });

        // Log the event
        const { data: event } = await supabase
            .from('reputation_crisis_events')
            .insert({
                clinic_id: crisis.clinicId,
                patient_id: crisis.patientId,
                call_id: crisis.callId,
                crisis_type: crisis.crisisType,
                severity: crisis.severity,
                voice_anger_score: crisis.angerScore,
                negative_keywords: crisis.negativeKeywords,
                patient_threat_to_leave: crisis.threatToLeave,
                review_risk_score: crisis.reviewRiskScore,
                escalated_to_human: true
            })
            .select()
            .single();

        // Immediate escalation for high/critical severity
        if (crisis.severity === 'high' || crisis.severity === 'critical') {
            await this.escalateToDoctor(crisis);
        } else {
            await this.escalateToSeniorStaff(crisis);
        }

        // Log autonomous action
        await supabase.from('autonomous_actions').insert({
            clinic_id: crisis.clinicId,
            patient_id: crisis.patientId,
            action_type: 'reputation_shield',
            action_taken: `Detected ${crisis.severity} severity crisis (${crisis.crisisType}). Auto-escalated to ${crisis.severity === 'critical' ? 'doctor' : 'senior staff'}.`,
            reasoning: `Anger score: ${crisis.angerScore}/100. Review risk: ${crisis.reviewRiskScore}/100. Negative keywords: ${crisis.negativeKeywords.join(', ')}. ${crisis.threatToLeave ? 'PATIENT THREATENED TO LEAVE.' : ''}`,
            confidence_score: crisis.reviewRiskScore,
            triggered_by: 'patient_frustration_detected',
            trigger_data: crisis,
            outcome: 'pending'
        });
    }

    /**
     * Escalate to doctor directly
     */
    private async escalateToDoctor(crisis: CrisisDetection) {
        // Use V2 Escalation Router
        // "Critical" severity -> EMERGENCY level check
        // "High" severity -> URGENT level (Office Manager)

        if (crisis.severity === 'critical') {
            await escalationRouter.route({
                level: 'EMERGENCY',
                context: `Critical Patient Crisis: ${crisis.patientName} threatening to leave/sue. Review Risk: ${crisis.reviewRiskScore}%`,
                clinicId: crisis.clinicId,
                patientId: crisis.patientId
            });
        } else {
            await escalationRouter.route({
                level: 'URGENT',
                context: `High Frustration Patient: ${crisis.patientName}. Needs callback to prevent review.`,
                clinicId: crisis.clinicId,
                patientId: crisis.patientId
            });
        }

        logger.info('Escalated crisis via EscalationRouter', { crisis });
    }

    /**
     * Escalate to senior staff
     */
    private async escalateToSeniorStaff(crisis: CrisisDetection) {
        // In a real system, this would route to senior receptionist or office manager
        // For now, we'll prepare the context for the AI to transfer

        await supabase.from('call_escalations').insert({
            call_id: crisis.callId,
            escalation_reason: crisis.crisisType,
            escalation_context: {
                anger_score: crisis.angerScore,
                negative_keywords: crisis.negativeKeywords,
                threat_to_leave: crisis.threatToLeave,
                review_risk: crisis.reviewRiskScore
            },
            escalated_at: new Date().toISOString(),
            escalated_to: 'senior_staff'
        });
    }

    /**
     * Mark crisis as resolved
     */
    async resolveCrisis(eventId: string, outcome: 'patient_satisfied' | 'partial_resolution' | 'patient_left' | 'review_posted') {
        const preventedReview = outcome === 'patient_satisfied' || outcome === 'partial_resolution';

        await supabase
            .from('reputation_crisis_events')
            .update({
                resolved: true,
                resolution_outcome: outcome,
                prevented_negative_review: preventedReview,
                resolved_at: new Date().toISOString()
            })
            .eq('id', eventId);

        // Update corresponding autonomous action
        await supabase
            .from('autonomous_actions')
            .update({
                outcome: preventedReview ? 'success' : 'failed',
                outcome_data: { resolution: outcome }
            })
            .eq('action_type', 'reputation_shield');

        logger.info('Crisis resolved', { eventId, outcome });
    }

    /**
     * Get reputation shield metrics
     */
    async getMetrics(clinicId: string, days: number = 30) {
        const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const { data: events } = await supabase
            .from('reputation_crisis_events')
            .select('*')
            .eq('clinic_id', clinicId)
            .gte('detected_at', cutoffDate.toISOString());

        if (!events || events.length === 0) {
            return {
                totalCrises: 0,
                criticalCrises: 0,
                preventedReviews: 0,
                preventionRate: 0
            };
        }

        const totalCrises = events.length;
        const criticalCrises = events.filter(e => e.severity === 'critical').length;

        const resolvedEvents = events.filter(e => e.resolved);
        const preventedReviews = resolvedEvents.filter(e => e.prevented_negative_review).length;
        const preventionRate = resolvedEvents.length > 0 ? (preventedReviews / resolvedEvents.length) * 100 : 0;

        return {
            totalCrises,
            criticalCrises,
            preventedReviews,
            preventionRate
        };
    }
}

// Singleton instance
export const reputationShieldEngine = new ReputationShieldEngine();
