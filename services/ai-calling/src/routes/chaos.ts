import { Router } from 'express';
import { chaosMonkey } from '../lib/chaos-monkey';
import { logger } from '../lib/logging/structured-logger';

const router = Router();

/**
 * GET /v2/ops/chaos/status
 * Get current chaos monkey settings
 */
router.get('/status', (req, res) => {
    res.json(chaosMonkey.getStatus());
});

/**
 * POST /v2/ops/chaos/configure
 * Update chaos monkey settings (Admin Only)
 */
router.post('/configure', (req, res) => {
    const { latencyMs, failureRate, activeServices } = req.body;

    chaosMonkey.configure({
        latencyMs: Number(latencyMs) || 0,
        failureRate: Number(failureRate) || 0,
        activeServices: new Set(Array.isArray(activeServices) ? activeServices : []),
    });

    res.json({ message: 'ChaosMonkey configured successfully', status: chaosMonkey.getStatus() });
});

/**
 * POST /v2/ops/chaos/reset
 * Reset chaos monkey to normal operation
 */
router.post('/reset', (req, res) => {
    chaosMonkey.reset();
    res.json({ message: 'ChaosMonkey reset', status: chaosMonkey.getStatus() });
});

export default router;
