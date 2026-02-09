import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { Server } from 'ws';
import outboundRoutes from './routes/outbound';
import webhookRoutes from './routes/webhooks';
import cronRoutes from './routes/cron';
import campaignRoutes from './routes/campaigns';
import analyticsRoutes from './routes/analytics';
import automationControlRoutes from './routes/automation-control';
import { logger } from './lib/logger';
import { StreamingVoiceHandler } from './lib/stream-handler';
import { getCircuitBreakerHealth } from './lib/circuit-breaker';
import { supabase } from './lib/supabase';

// Persistent Job Queue (Phase 8 Hardening)
import { initJobQueue, stopJobQueue, getJobStats } from './lib/job-queue';
import { initJobHandlers, scheduleAllJobs } from './lib/job-handlers';
import { initializePrecachedAudio } from './lib/tts-provider';

// Load env vars
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true })); // Important for Twilio
app.use(bodyParser.json({ limit: '10mb' })); // Reduced from 50mb for safety

// Basic health check
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// Enhanced health check with liveness data
app.get('/health/detailed', async (req, res) => {
    try {
        // Check Supabase connection
        const { error: dbError } = await supabase.from('clinics').select('id').limit(1);
        const dbHealthy = !dbError;

        // Get circuit breaker status
        const circuitBreakers = getCircuitBreakerHealth();

        const status = {
            status: dbHealthy && circuitBreakers.allHealthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            database: {
                connected: dbHealthy,
                error: dbError?.message
            },
            circuitBreakers: {
                twilio: circuitBreakers.twilio.state,
                gemini: circuitBreakers.gemini.state,
                allHealthy: circuitBreakers.allHealthy
            },
            version: process.env.npm_package_version || '1.0.0'
        };

        const httpStatus = status.status === 'healthy' ? 200 : 503;
        res.status(httpStatus).json(status);
    } catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            error: (error as Error).message
        });
    }
});

import vapiWebhookRoutes from './routes/vapi-webhooks';
import recallRoutes from './routes/recall';
import widgetRoutes from './routes/widget';
import billingRoutes from './routes/billing';
import stripeWebhookRoutes from './routes/stripe-webhooks';
import operationsRoutes from './routes/operations';
import { runFailureDetection, runAutoRecovery } from './lib/operations-reliability';

// Routes
app.use('/v1/calls', outboundRoutes);
app.use('/v1/webhooks', webhookRoutes);
app.use('/v1/webhooks', vapiWebhookRoutes); // Vapi Events
app.use('/v1/webhooks', stripeWebhookRoutes); // Stripe Events
app.use('/v1/cron', cronRoutes);
app.use('/v1/campaigns', campaignRoutes);
app.use('/v1/analytics', analyticsRoutes);
app.use('/v1/recall', recallRoutes);
app.use('/v1/appointments', widgetRoutes);
app.use('/v1/billing', billingRoutes);
app.use('/v1/automation', automationControlRoutes);
app.use('/v1/ops', operationsRoutes);

// Background operations monitoring (runs every 5 minutes)
const OPS_MONITOR_INTERVAL_MS = 5 * 60 * 1000;
let opsMonitorTimer: NodeJS.Timeout | null = null;

async function runOpsMonitor() {
    try {
        const failures = await runFailureDetection();
        if (failures.length > 0) {
            logger.warn(`Operations monitor detected ${failures.length} failures`);
            const recoveries = await runAutoRecovery(failures);
            logger.info(`Auto-recovery completed: ${recoveries.filter(r => r.result === 'success').length} successful`);
        }
    } catch (error) {
        logger.error('Operations monitor error', { error: (error as Error).message });
    }
}

function startOpsMonitor() {
    // Initial run after 30 seconds (let system stabilize)
    setTimeout(() => {
        runOpsMonitor();
        // Then run every 5 minutes
        opsMonitorTimer = setInterval(runOpsMonitor, OPS_MONITOR_INTERVAL_MS);
    }, 30000);
}

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: 'Internal server error' });
});

const server = app.listen(PORT, async () => {
    logger.info(`Server running on port ${PORT}`);

    // PHASE 8: Initialize persistent job queue (replaces volatile setInterval)
    try {
        // Initialize pg-boss
        await initJobQueue();

        // Register all job handlers
        await initJobHandlers();

        // Schedule recurring jobs
        await scheduleAllJobs();

        logger.info('✅ Persistent job queue fully initialized');

        // Pre-cache TTS audio for backchannel
        await initializePrecachedAudio();

    } catch (error) {
        logger.error('Failed to initialize job queue', { error: (error as Error).message });
        // Fall back to legacy setInterval monitoring
        logger.warn('Falling back to legacy setInterval monitoring');
        startOpsMonitor();
    }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');

    // Stop ops monitor (legacy)
    if (opsMonitorTimer) {
        clearInterval(opsMonitorTimer);
    }

    // Stop job queue gracefully
    try {
        await stopJobQueue();
    } catch (error) {
        logger.error('Error stopping job queue', { error: (error as Error).message });
    }

    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

// WebSocket Server for Media Streams (real-time audio)
const wss = new Server({
    server,
    path: '/v1/streams'  // Match Twilio Media Streams URL
});

wss.on('connection', (ws) => {
    logger.info('WebSocket client connected for streaming audio');
    new StreamingVoiceHandler(ws);
});

logger.info(`Server with streaming enabled on port ${PORT}`);
