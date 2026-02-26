/**
 * MANUAL TEST: Concurrency Isolation Check
 * Verifies that BackchannelManager instances are isolated and don't share state.
 * Run with: npx ts-node services/ai-calling/src/__manual-tests__/concurrency-check.ts
 */

import { BackchannelManager } from '../lib/backchannel-manager';

// Mock logger to avoid clutter
const logger = {
  debug: () => {},
  info: (msg: string, data?: any) => console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg: string) => console.log(`[WARN] ${msg}`),
  error: (msg: string, err?: any) => console.error(`[ERROR] ${msg}`, err),
};

// We need to bypass the actual logger import in backchannel-manager if possible,
// or just let it log. ideally we'd mock it but for a simple manual test we can ignore.

async function runTest() {
  console.log('Starting Concurrency Isolation Test...\n');

  const call1 = new BackchannelManager();
  const call2 = new BackchannelManager();

  const call1Events: string[] = [];
  const call2Events: string[] = [];

  // Start Call 1
  console.log('Starting Call 1 (Should fire events)...');
  call1.start(
    async (text) => {
      console.log(`[Call 1] Speaking: "${text}"`);
      call1Events.push(text);
    },
    async () => {
      console.log(`[Call 1] Timeout!`);
    },
  );

  // Call 2 should NOT be started yet
  console.log('Call 2 initialized but NOT started.');

  // Wait 500ms (Call 1 should invoke "Hmm")
  await new Promise((r) => setTimeout(r, 500));

  // Start Call 2
  console.log('\nStarting Call 2 (Should start its own separate timeline)...');
  call2.start(
    async (text) => {
      console.log(`[Call 2] Speaking: "${text}"`);
      call2Events.push(text);
    },
    async () => {
      console.log(`[Call 2] Timeout!`);
    },
  );

  // Wait 2000ms
  // Call 1 should be at ~2.5s ("Let me check on that")
  // Call 2 should be at ~2.0s ("Let me check on that")
  await new Promise((r) => setTimeout(r, 2000));

  // Stop Call 1
  console.log('\nStopping Call 1...');
  call1.stop();

  // Wait another 1000ms
  // Call 1 should receive NO more events
  // Call 2 should receive "One moment please" (at 3000ms mark)
  await new Promise((r) => setTimeout(r, 1000));

  console.log('\nStopping Call 2...');
  call2.stop();

  console.log('\n--- RESULTS ---');
  console.log(`Call 1 Events: ${call1Events.length} (Expected >= 2, got ${call1Events.length})`);
  console.log(`Call 2 Events: ${call2Events.length} (Expected >= 2, got ${call2Events.length})`);

  // Verify Isolation
  if (call1Events.length >= 2 && call2Events.length >= 2) {
    console.log('✅ SUCCESS: Both calls fired events independent of each other.');
  } else {
    console.error('❌ FAILURE: Events missing. Singleton/State issue likely.');
    process.exit(1);
  }
}

runTest().catch(console.error);
