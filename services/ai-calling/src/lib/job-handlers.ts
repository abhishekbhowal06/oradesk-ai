/**
 * JOB HANDLERS REGISTRY
 * 
 * Registers all autonomous engine cycles as persistent jobs.
 * Replaces volatile setInterval with crash-resilient pg-boss jobs.
 */

import {
    registerJobHandler,
    scheduleRecurringJob,
    JobPayload,
    Job
} from './job-queue';
import { logger } from './logger';
import { supabase } from './supabase';

// Import engines (we'll call their internal methods directly)
import { morningHuddleReporter } from './engines/morning-huddle';
import { runFailureDetection, runAutoRecovery } from './operations-reliability';

/**
 * Initialize all job handlers and schedules
 * Call this after initJobQueue()
 */
export async function initJobHandlers(): Promise<void> {
    logger.info('Registering job handlers...');

    // 1. CANCELLATION PREVENTION CYCLE
    await registerJobHandler('cancellation_prevention_cycle', async (job: Job<JobPayload>) => {
        logger.info('Running cancellation prevention cycle via job queue');

        // Import dynamically to get latest instance
        const { CancellationPreventionEngine } = await import('./autonomous/cancellation-prevention');
        const engine = new CancellationPreventionEngine();

        // Run single cycle (not the interval loop)
        await (engine as any).runPreventionCycle();
    });

    // 2. REVENUE STABILIZATION CYCLE
    await registerJobHandler('revenue_stabilization_cycle', async (job: Job<JobPayload>) => {
        logger.info('Running revenue stabilization cycle via job queue');

        const { RevenueStabilizationEngine } = await import('./autonomous/revenue-stabilization');
        const engine = new RevenueStabilizationEngine();

        await (engine as any).runStabilizationCycle();
    });

    // 3. NO-SHOW PREDICTION CYCLE
    await registerJobHandler('no_show_prediction_cycle', async (job: Job<JobPayload>) => {
        logger.info('Running no-show prediction cycle via job queue');

        const { NoShowPredictionEngine } = await import('./autonomous/no-show-prediction');
        const engine = new NoShowPredictionEngine();

        await (engine as any).runPredictionCycle();
    });

    // 4. MORNING HUDDLE GENERATION
    await registerJobHandler('morning_huddle_generation', async (job: Job<JobPayload>) => {
        logger.info('Generating morning huddle reports via job queue');

        // Get all active clinics
        const { data: clinics } = await supabase
            .from('clinics')
            .select('id, name, timezone')
            .eq('is_active', true);

        if (!clinics) return;

        for (const clinic of clinics) {
            try {
                // Check if it's actually morning in this clinic's timezone
                const now = new Date();
                const clinicHour = getHourInTimezone(now, clinic.timezone || 'America/New_York');

                // Only generate if it's between 7 and 8 AM in clinic's timezone
                if (clinicHour >= 7 && clinicHour < 8) {
                    const report = await morningHuddleReporter.generateDailyReport(clinic.id);
                    logger.info(`Morning Huddle generated for ${clinic.name}`, {
                        reportLength: report.length
                    });

                    // TODO: Send report via preferred channel (email, dashboard, SMS)
                }
            } catch (error) {
                logger.error(`Morning Huddle failed for clinic ${clinic.id}`, {
                    error: (error as Error).message
                });
            }
        }
    });

    // 5. OPERATIONS HEALTH CHECK
    await registerJobHandler('operations_health_check', async (job: Job<JobPayload>) => {
        logger.info('Running operations health check via job queue');

        const failures = await runFailureDetection();
        if (failures.length > 0) {
            logger.warn(`Detected ${failures.length} operational failures`);
            const recoveries = await runAutoRecovery(failures);
            logger.info(`Auto-recovery: ${recoveries.filter(r => r.result === 'success').length} successful`);
        }
    });

    // 6. RECALL CAMPAIGN BATCH
    await registerJobHandler('recall_campaign_batch', async (job: Job<JobPayload>) => {
        logger.info('Running recall campaign batch via job queue');

        // TODO: Implement batch recall processing
        // This would fetch pending recall candidates and queue calls
    });

    logger.info('✅ All job handlers registered');
}

/**
 * Schedule all recurring jobs
 * Call this after initJobHandlers()
 */
export async function scheduleAllJobs(): Promise<void> {
    logger.info('Scheduling recurring jobs...');

    await scheduleRecurringJob('cancellation_prevention_cycle');
    await scheduleRecurringJob('revenue_stabilization_cycle');
    await scheduleRecurringJob('no_show_prediction_cycle');
    await scheduleRecurringJob('morning_huddle_generation');
    await scheduleRecurringJob('operations_health_check');
    await scheduleRecurringJob('recall_campaign_batch');

    logger.info('✅ All recurring jobs scheduled');
}

/**
 * Helper: Get current hour in a specific timezone
 */
function getHourInTimezone(date: Date, timezone: string): number {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false
    });
    return parseInt(formatter.format(date));
}
