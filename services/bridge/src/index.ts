import dotenv from 'dotenv';
import cron from 'node-cron';
import { SyncAgent } from './sync-agent';
import { logger } from './logger';

dotenv.config();

const SYNC_INTERVAL = process.env.SYNC_INTERVAL || '*/5 * * * *'; // Default: Every 5 mins
const CLINIC_ID = process.env.CLINIC_ID;

if (!CLINIC_ID) {
    logger.error("CLINIC_ID is required in .env");
    process.exit(1);
}

// Initialize Agent
const agent = new SyncAgent(CLINIC_ID);

logger.info(`Dentacore Bridge Agent Starting for Clinic: ${CLINIC_ID}`);
logger.info(`Sync Interval: ${SYNC_INTERVAL}`);

// Schedule Cron
cron.schedule(SYNC_INTERVAL, async () => {
    logger.info("Starting scheduled sync...");
    try {
        await agent.runSync();
    } catch (error) {
        logger.error("Sync failed", error);
    }
});

// Run once on startup
agent.runSync().catch(err => logger.error("Startup sync failed", err));
