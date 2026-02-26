import { config } from 'dotenv';
config();

import { registerCampaignWorker, CAMPAIGN_JOB_NAME } from '../services/CampaignWorker';
import { initJobQueue, getJobQueue } from '../lib/job-queue';

async function testCampaignWorker() {
    console.log('--- Phase 4: Campaign Worker Test ---');
    try {
        const boss = await initJobQueue();
        await registerCampaignWorker();

        console.log('Worker registered. Queuing 10 mock jobs to test concurrency limits...');

        const testClinicId = '00000000-0000-0000-0000-000000000002'; // Demo Clinic

        for (let i = 0; i < 10; i++) {
            await boss.send(CAMPAIGN_JOB_NAME, {
                clinicId: testClinicId,
                patientId: `pat_${i}`,
                phone: `+1555000000${i}`,
                callType: 'recall',
                triggeredAt: new Date().toISOString()
            });
        }

        console.log('Jobs queued! Watch the logs to ensure concurrency hits the limit (max 5) and starts deferring/failing with backoff.');
        console.log('Press Ctrl+C to stop.');

        // Let it run for 10 seconds to observe logs
        await new Promise(resolve => setTimeout(resolve, 10000));

        await boss.stop();
        console.log('Test completed.');
        process.exit(0);

    } catch (err) {
        console.error('Test failed', err);
        process.exit(1);
    }
}

testCampaignWorker();
