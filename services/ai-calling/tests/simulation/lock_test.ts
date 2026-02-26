
import { withLock } from '../../src/lib/distributed-lock';
import { logger } from '../../src/lib/logging/structured-logger';

// Mock Supabase/DB interaction is handled by the real distributed-lock.ts 
// which uses the real supabase client. We assume .env is set up.

async function testDistributedLocking() {
    console.log('🔒 Starting Distributed Lock Simulation...');

    const lockKey = 'test-race-condition-key-' + Date.now();

    // Simulate Worker A
    const workerA = async () => {
        console.log('Worker A: Attempting to acquire lock...');
        const result = await withLock(lockKey, async () => {
            console.log('Worker A: Lock ACQUIRED! Working for 2 seconds...');
            await new Promise(r => setTimeout(r, 2000));
            console.log('Worker A: Finished work.');
            return 'A_SUCCESS';
        }, { skipIfLocked: true });

        if (!result) console.log('Worker A: Failed to acquire lock.');
        return result;
    };

    // Simulate Worker B (starts 500ms after A)
    const workerB = async () => {
        await new Promise(r => setTimeout(r, 500));
        console.log('Worker B: Attempting to acquire lock...');
        const result = await withLock(lockKey, async () => {
            console.log('Worker B: Lock ACQUIRED! (Should not happen)');
            return 'B_SUCCESS';
        }, { skipIfLocked: true });

        if (!result) console.log('Worker B: Failed to acquire lock (EXPECTED).');
        return result;
    };

    // Run racing
    console.log('🏁 Race started!');
    const [resA, resB] = await Promise.all([workerA(), workerB()]);

    console.log('---------------------------------------------------');
    console.log(`Worker A Result: ${resA}`);
    console.log(`Worker B Result: ${resB}`);

    if (resA === 'A_SUCCESS' && resB === null) {
        console.log('✅ TEST PASSED: Mutual exclusion verified.');
    } else {
        console.error('❌ TEST FAILED: Mutual exclusion broken.');
        process.exit(1);
    }
}

testDistributedLocking().catch(err => {
    console.error(err);
    process.exit(1);
});
