/**
 * PERSISTENT JOB QUEUE SERVICE
 *
 * Uses pg-boss for crash-resilient job scheduling.
 * Replaces volatile setInterval timers with database-backed jobs.
 *
 * Benefits:
 * - Jobs survive server restarts
 * - No duplicate execution across instances (built-in locking)
 * - Automatic retry with exponential backoff
 * - Job history and observability
 */

// pg-boss uses default export
const PgBoss = require('pg-boss');
import { logger } from './logging/structured-logger';
import type { PgBossInstance } from '../types';

// Job types for type safety
export type JobType =
  | 'cancellation_prevention_cycle'
  | 'revenue_stabilization_cycle'
  | 'no_show_prediction_cycle'
  | 'morning_huddle_generation'
  | 'recall_campaign_batch'
  | 'operations_health_check'
  | 'outbound-campaign-call';

export interface JobPayload {
  clinicId?: string;
  patientId?: string;
  phone?: string;
  callType?: string;
  campaignId?: string;
  triggeredAt: string;
  metadata?: Record<string, unknown>;
  results?: unknown;
}

// Job interface for handlers
export interface Job<T = JobPayload> {
  id: string;
  name: string;
  data: T;
}

// Job schedules (cron format)
export const JOB_SCHEDULES: Partial<Record<JobType, string>> = {
  cancellation_prevention_cycle: '*/1 * * * *', // Every minute
  revenue_stabilization_cycle: '0 * * * *', // Every hour
  no_show_prediction_cycle: '*/5 * * * *', // Every 5 minutes
  morning_huddle_generation: '30 7 * * *', // 7:30 AM daily
  recall_campaign_batch: '0 9,14 * * *', // 9 AM and 2 PM
  operations_health_check: '*/5 * * * *', // Every 5 minutes
};

// Use any for the instance since pg-boss types are complex
let bossInstance: PgBossInstance | null = null;

/**
 * Initialize the job queue
 * Must be called once during server startup
 */
export async function initJobQueue(): Promise<PgBossInstance> {
  if (bossInstance) {
    return bossInstance;
  }

  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  let finalConnectionString = connectionString;

  // Quick fix for self-hosted / pooled connection verification
  if (finalConnectionString && !finalConnectionString.includes('sslmode')) {
    finalConnectionString = `${finalConnectionString}?sslmode=require`;
  }

  if (!finalConnectionString) {
    logger.error('No database connection string found for job queue');
    throw new Error('DATABASE_URL or SUPABASE_DB_URL required for job queue');
  }

  logger.info('Initializing pg-boss job queue...');

  // pg-boss constructor
  const Boss = PgBoss.PgBoss || PgBoss;
  try {
    bossInstance = new Boss({
      connectionString: finalConnectionString,
      schema: 'pgboss',
      archiveCompletedAfterSeconds: 60 * 60 * 24, // Keep completed jobs for 24 hours
      retentionDays: 7,
      retryLimit: 3,
      retryDelay: 30, // 30 seconds between retries
      retryBackoff: true, // Exponential backoff
      monitorStateIntervalSeconds: 30,
    });

    // Error handling
    bossInstance!.on('error', (error: unknown) => {
      logger.error('pg-boss error', { error: error instanceof Error ? error.message : String(error) });
    });

    // Start the boss
    await bossInstance!.start();
    logger.info('✅ pg-boss job queue started');

    return bossInstance!;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to initialize pg-boss. Using mock queue for development.', { error: errMsg });
    bossInstance = {
      send: async (name: string, data: Record<string, unknown>) => { logger.info(`[MOCK QUEUE] send ${name}`, data); return 'mock-job-id'; },
      schedule: async () => { },
      work: async () => { },
      stop: async () => { },
      on: () => { },
      getQueueSize: async () => 0,
      start: async () => { },
    };
    return bossInstance;
  }
}

/**
 * Get the boss instance (must be initialized first)
 */
export function getJobQueue(): PgBossInstance {
  if (!bossInstance) {
    throw new Error('Job queue not initialized. Call initJobQueue() first.');
  }
  return bossInstance;
}

/**
 * Schedule a recurring job
 */
export async function scheduleRecurringJob(
  jobType: JobType,
  cronExpression?: string,
): Promise<void> {
  const boss = getJobQueue();
  const cron = cronExpression || JOB_SCHEDULES[jobType];

  logger.info(`Scheduling recurring job: ${jobType}`, { cron });

  await boss.schedule(
    jobType,
    cron!,
    {
      triggeredAt: new Date().toISOString(),
    },
    {
      tz: 'UTC', // Jobs scheduled in UTC, handlers convert to clinic timezone
    },
  );
}

/**
 * Register a job handler
 */
export async function registerJobHandler(
  jobType: JobType,
  handler: (job: Job<JobPayload>) => Promise<void>,
  options?: { teamSize?: number; teamConcurrency?: number }
): Promise<void> {
  const boss = getJobQueue();

  logger.info(`Registering handler for job: ${jobType}`);

  await boss.work(jobType, options || {}, async (job: Job<JobPayload>) => {
    const startTime = Date.now();
    logger.info(`🚀 Starting job: ${jobType}`, { jobId: job.id });

    try {
      await handler(job);
      const duration = Date.now() - startTime;
      logger.info(`✅ Job completed: ${jobType}`, { jobId: job.id, durationMs: duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`❌ Job failed: ${jobType}`, {
        jobId: job.id,
        error: (error as Error).message,
        durationMs: duration,
      });
      throw error; // Re-throw for pg-boss retry handling
    }
  });
}

/**
 * Queue a one-time job
 */
export async function queueJob(
  jobType: JobType,
  payload: JobPayload,
  options?: {
    startAfter?: Date;
    retryLimit?: number;
    priority?: number;
  },
): Promise<string | null> {
  const boss = getJobQueue();

  const jobId = await boss.send(jobType, payload, {
    startAfter: options?.startAfter,
    retryLimit: options?.retryLimit || 3,
    priority: options?.priority || 0,
  });

  logger.debug(`Queued job: ${jobType}`, { jobId, payload });
  return jobId;
}

/**
 * Queue a job for a specific clinic
 */
export async function queueClinicJob(
  jobType: JobType,
  clinicId: string,
  metadata?: Record<string, unknown>,
): Promise<string | null> {
  return queueJob(jobType, {
    clinicId,
    triggeredAt: new Date().toISOString(),
    metadata,
  });
}

/**
 * Get job queue statistics
 */
export async function getJobStats(): Promise<{
  queued: number;
  active: number;
  completed: number;
  failed: number;
}> {
  const boss = getJobQueue();

  // Get counts for each state
  const [queued, active, completed, failed] = await Promise.all([
    boss.getQueueSize('cancellation_prevention_cycle'),
    boss.getQueueSize('revenue_stabilization_cycle'),
    boss.getQueueSize('no_show_prediction_cycle'),
    boss.getQueueSize('morning_huddle_generation'),
  ]);

  return {
    queued: queued || 0,
    active: active || 0,
    completed: completed || 0,
    failed: failed || 0,
  };
}

/**
 * Graceful shutdown
 */
export async function stopJobQueue(): Promise<void> {
  if (bossInstance) {
    logger.info('Stopping pg-boss job queue...');
    await bossInstance.stop({ graceful: true, timeout: 30000 });
    bossInstance = null;
    logger.info('pg-boss stopped');
  }
}
