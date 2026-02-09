/**
 * YIELD OPTIMIZER (The "Should We?")
 * 
 * Purpose: Protect hourly production ($/hr) and prevent cannibalization.
 * 
 * Logic Rules:
 * 1. Prime Time Protection (8-10 AM)
 * 2. Revenue Rescue (Fill at all costs if way under target)
 * 3. Procedure Mix Balancing
 */

import { logger } from '../logger';

export interface YieldRequest {
    procedureEstimatedValue: number;
    slotStartTime: Date;
    currentDayProduction: number;
    dailyGoal: number;
}

export interface YieldResult {
    decision: 'APPROVE' | 'REJECT' | 'HOLD_FOR_BETTER';
    yieldScore: number; // 0.0 - 1.0
    reason: string;
}

export class YieldOptimizer {

    check(request: YieldRequest): YieldResult {
        const hour = request.slotStartTime.getHours();
        const productionGap = request.dailyGoal - request.currentDayProduction;
        const hoursUntilSlot = (request.slotStartTime.getTime() - Date.now()) / (1000 * 60 * 60);

        // RULE 1: REVENUE RESCUE (Panic Mode)
        // If we are <50% of goal and it's tomorrow -> TAKE ANYTHING
        if (request.currentDayProduction < (request.dailyGoal * 0.5) && hoursUntilSlot < 24) {
            return {
                decision: 'APPROVE',
                yieldScore: 1.0,
                reason: 'Revenue Rescue: Day is significantly under target'
            };
        }

        // RULE 2: PRIME TIME PROTECTION
        // 8 AM - 10 AM is Prime Time. High energy. High value only.
        const isPrimeTime = hour >= 8 && hour < 10;
        const isHighValue = request.procedureEstimatedValue > 250; // $250+ procedure

        if (isPrimeTime && !isHighValue) {
            // Only allow low value in prime time if it's last minute (<18 hours)
            if (hoursUntilSlot > 18) {
                return {
                    decision: 'HOLD_FOR_BETTER',
                    yieldScore: 0.2,
                    reason: 'Prime Time Protection: Holding slot for high-value procedure'
                };
            }
        }

        // RULE 3: END OF DAY FILL
        // fill 3 PM - 5 PM with anything to keep hygiene busy
        if (hour >= 15) {
            return {
                decision: 'APPROVE',
                yieldScore: 0.9,
                reason: 'End of Day Fill'
            };
        }

        // Default
        return {
            decision: 'APPROVE',
            yieldScore: 0.8,
            reason: 'Standard Booking'
        };
    }
}

export const yieldOptimizer = new YieldOptimizer();
