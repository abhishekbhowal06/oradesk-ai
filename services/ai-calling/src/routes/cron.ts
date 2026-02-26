import { Router } from 'express';
import { logger } from '../lib/logging/structured-logger';
import { careLoopEngine } from '../lib/engines/care-loop';

const router = Router();

// Triggered by Cloud Scheduler every 5-15 mins
router.post('/process-followups', async (req, res) => {
  try {
    const count = await careLoopEngine.processDueLoops(); // Should return count

    // Legacy support wrapper or void return handling
    res.json({ message: 'CareLoop processing completed' });
  } catch (error) {
    logger.error('Cron job failed', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

