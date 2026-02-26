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
import authRoutes from './routes/auth';
import { metricsRegistry } from './lib/metrics';
import { logger } from './lib/logging/structured-logger';
import { ConnectionManager } from './lib/stream/ConnectionManager';
import { getCircuitBreakerHealth } from './lib/circuit-breaker';
import { supabaseAdmin } from './lib/supabase';
import { requireAuth, requireClinicAccess } from './middleware/auth';

// Persistent Job Queue (Phase 8 Hardening)
import { initJobQueue, stopJobQueue, getJobStats } from './lib/job-queue';
import { initJobHandlers, scheduleAllJobs } from './lib/job-handlers';
import { initializePrecachedAudio } from './lib/tts-provider';
import { warmFillerCache } from './config/fillers';

// Load env vars
dotenv.config();

import { getSecret } from './lib/secrets';

const app = express();
const PORT = process.env.PORT || 8080;

// CORS - restricted to frontend origin (no wildcard)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:8085';
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(bodyParser.urlencoded({ extended: true })); // Important for Twilio
app.use(bodyParser.json({ limit: '10mb' })); // Reduced from 50mb for safety

// ── Security Headers (Helmet) ─────────────────────────
// CRITICAL: Protects against XSS, clickjacking, MIME sniffing, and protocol downgrade
import helmet from 'helmet';
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", process.env.SUPABASE_URL || '', FRONTEND_URL],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Required for streaming audio
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

import { tracingMiddleware } from './middleware/tracing';
app.use(tracingMiddleware);

import { globalLimiter, authLimiter, callsLimiter, webhookLimiter } from './middleware/rate-limiter';
// Apply global rate limiter to all requests
app.use(globalLimiter);

// Basic health check
app.get('/health', (req, res) => {
  logger.info('Health check requested');
  res.status(200).send('OK');
});


// Enhanced health check with liveness data
app.get('/health/detailed', async (req, res) => {
  try {
    // Check Supabase connection
    const { error: dbError } = await supabaseAdmin.from('clinics').select('id').limit(1);
    const dbHealthy = !dbError;

    // Get circuit breaker status
    const circuitBreakers = getCircuitBreakerHealth();

    // Get active websocket connections
    const { getActiveConnections } = require('./lib/stream/ConnectionManager');

    // FIX: Status logic was defaulting to degraded even if sub-checks passed
    const isHealthy = dbHealthy && circuitBreakers.allHealthy;

    const status = {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      database: {
        connected: dbHealthy,
        error: dbError?.message,
      },
      metrics: {
        active_websocket_connections: getActiveConnections()
      },
      circuitBreakers: {
        twilio: circuitBreakers.twilio.state,
        gemini: circuitBreakers.gemini.state,
        allHealthy: circuitBreakers.allHealthy,
      },
      version: process.env.npm_package_version || '1.0.0',
    };

    const httpStatus = isHealthy ? 200 : 503;
    res.status(httpStatus).json(status);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: (error as Error).message,
    });
  }
});

import vapiWebhookRoutes from './routes/vapi-webhooks';
import recallRoutes from './routes/recall';
import widgetRoutes from './routes/widget';
import billingRoutes from './routes/billing';
import stripeWebhookRoutes from './routes/stripe-webhooks';
import operationsRoutes from './routes/operations';
import calendarRoutes from './routes/calendar';
import bridgeRoutes from './routes/bridge';
import { runFailureDetection, runAutoRecovery } from './lib/operations-reliability';
import dataManagementRoutes from './routes/data-management';
import chaosRoutes from './routes/chaos';

// ─── PUBLIC ROUTES (no auth required) ───────────────────────
// Webhooks use their own signature verification (Twilio/Stripe/Vapi)
app.use('/v1/webhooks', webhookLimiter, webhookRoutes);
app.use('/v1/auth', authLimiter, authRoutes); // Public Auth Routes
app.use('/v1/webhooks', webhookLimiter, vapiWebhookRoutes); // Vapi Events
app.use('/v1/webhooks', webhookLimiter, stripeWebhookRoutes); // Stripe Events
app.use('/v1/webhooks/google-calendar', webhookLimiter, calendarRoutes); // Google Calendar Push Notifications (public)
app.use('/v1/bridge/agent', authLimiter, bridgeRoutes); // Bridge Agent Endpoints (device-token auth)

// ─── AUTHENTICATED ROUTES (JWT required) ────────────────────
app.use('/v1/calls', callsLimiter, requireAuth, requireClinicAccess, outboundRoutes);
app.use('/v1/cron', requireAuth, cronRoutes);
app.use('/v1/campaigns', requireAuth, requireClinicAccess, campaignRoutes);
app.use('/v1/analytics', requireAuth, requireClinicAccess, analyticsRoutes);
app.use('/v1/recall', requireAuth, requireClinicAccess, recallRoutes);
app.use('/v1/appointments', requireAuth, requireClinicAccess, widgetRoutes);
app.use('/v1/billing', requireAuth, requireClinicAccess, billingRoutes);
app.use('/v1/automation', requireAuth, requireClinicAccess, automationControlRoutes);
app.use('/v1/ops', requireAuth, requireClinicAccess, operationsRoutes);
app.use('/v1/calendar', requireAuth, requireClinicAccess, calendarRoutes); // Calendar Integration
app.use('/v1/bridge', requireAuth, requireClinicAccess, bridgeRoutes); // PMS Bridge Admin
app.use('/v1/data', requireAuth, requireClinicAccess, dataManagementRoutes); // GDPR Data Management

// ─── API V2 (ENTERPRISE STABLE CONTRACT) ──────────────────────
// Mounted as direct aliases to establish the v2 path space
app.use('/v2/calls', callsLimiter, requireAuth, requireClinicAccess, outboundRoutes);
app.use('/v2/campaigns', requireAuth, requireClinicAccess, campaignRoutes);
app.use('/v2/analytics', requireAuth, requireClinicAccess, analyticsRoutes);
app.use('/v2/recall', requireAuth, requireClinicAccess, recallRoutes);
app.use('/v2/appointments', requireAuth, requireClinicAccess, widgetRoutes);
app.use('/v2/billing', requireAuth, requireClinicAccess, billingRoutes);
app.use('/v2/automation', requireAuth, requireClinicAccess, automationControlRoutes);
app.use('/v2/ops', requireAuth, requireClinicAccess, operationsRoutes);
app.use('/v2/calendar', requireAuth, requireClinicAccess, calendarRoutes);
app.use('/v2/bridge', requireAuth, requireClinicAccess, bridgeRoutes);
app.use('/v2/data', requireAuth, requireClinicAccess, dataManagementRoutes);
app.use('/v2/ops/chaos', requireAuth, requireClinicAccess, chaosRoutes);

// Prometheus Metrics Endpoint (Unauthenticated for scrapers)
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});

// Background operations monitoring (runs every 1 minute)
const OPS_MONITOR_INTERVAL_MS = 60 * 1000;
let opsMonitorTimer: NodeJS.Timeout | null = null;

async function runOpsMonitor() {
  try {
    const failures = await runFailureDetection();
    if (failures.length > 0) {
      logger.warn(`Operations monitor detected ${failures.length} failures`);
      const recoveries = await runAutoRecovery(failures);
      logger.info(
        `Auto-recovery completed: ${recoveries.filter((r) => r.result === 'success').length} successful`,
      );
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

import * as fs from 'fs';
const server = app.listen(PORT, async () => {
  fs.writeFileSync('server.log', `Server running on port ${PORT} at ${new Date().toISOString()}\n`);
  console.log(`DEBUG: Server attempting to listen on port ${PORT}`);
  logger.info(`Server running on port ${PORT}`);

  // Verify DB Access
  const { count, error: dbVerifyError } = await supabaseAdmin
    .from('clinics')
    .select('*', { count: 'exact', head: true });
  if (dbVerifyError) {
    console.error(
      'CRITICAL: Failed to access clinics table on startup:',
      JSON.stringify(dbVerifyError),
    );
  } else {
    console.log(`DEBUG: Startup DB Check - Clinics count: ${count}`);
  }

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

    // Pre-generate filler audio clips (ElevenLabs) for tool latency masking
    await warmFillerCache();
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
  path: '/v1/streams', // Match Twilio Media Streams URL
});

wss.on('connection', (ws) => {
  logger.info('WebSocket client connected for streaming audio');

  // UNIFIED VOICE PIPELINE (V2 Modular Architecture)
  // Enforces ConnectionManager as the sole authority for streaming and tool execution.
  new ConnectionManager(ws);
});

logger.info(`Server with streaming enabled on port ${PORT}`);
