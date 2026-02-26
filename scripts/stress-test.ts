#!/usr/bin/env npx ts-node
/**
 * ═══════════════════════════════════════════════════════════════
 * STRESS BOT — "The Crash Test"
 * ═══════════════════════════════════════════════════════════════
 *
 * Sends N concurrent simulated Twilio webhook requests to the
 * backend to test if it survives under load.
 *
 * Monitors:
 *  - HTTP response codes (should all be 200)
 *  - Response times (p50, p95, p99, max)
 *  - Memory usage before/after
 *  - Error rate
 *
 * Usage:
 *   npx ts-node scripts/stress-test.ts
 *   npx ts-node scripts/stress-test.ts --concurrent=100 --url=http://localhost:3000
 *
 * ═══════════════════════════════════════════════════════════════
 */

import * as fs from 'fs';
import * as path from 'path';

// ── Config ───────────────────────────────────────────────────

const BASE_URL =
  process.argv.find((a) => a.startsWith('--url='))?.split('=')[1] || 'http://localhost:3000';
const CONCURRENT = parseInt(
  process.argv.find((a) => a.startsWith('--concurrent='))?.split('=')[1] || '50',
  10,
);
const PHASES = [
  { name: 'Warm-Up', concurrency: 5, requests: 10 },
  { name: 'Ramp-Up', concurrency: Math.ceil(CONCURRENT / 2), requests: CONCURRENT },
  { name: 'Full Load', concurrency: CONCURRENT, requests: CONCURRENT * 2 },
  { name: 'Spike', concurrency: CONCURRENT * 2, requests: CONCURRENT * 3 },
];

// ── Simulated Twilio Payload ─────────────────────────────────

function makeTwilioPayload(index: number) {
  return {
    AccountSid: 'AC_stress_test_' + index,
    CallSid: `CA_stress_${Date.now()}_${index}`,
    CallStatus: 'ringing',
    Called: '+15551234567',
    Caller: `+1555000${String(index).padStart(4, '0')}`,
    Direction: 'inbound',
    From: `+1555000${String(index).padStart(4, '0')}`,
    To: '+15551234567',
  };
}

// ── Metrics ──────────────────────────────────────────────────

interface RequestResult {
  index: number;
  status: number;
  latencyMs: number;
  error?: string;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ── Fire a single request ────────────────────────────────────

async function fireRequest(index: number, endpoint: string): Promise<RequestResult> {
  const start = performance.now();

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeTwilioPayload(index)),
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    const latencyMs = Math.round(performance.now() - start);

    return {
      index,
      status: response.status,
      latencyMs,
    };
  } catch (err) {
    return {
      index,
      status: 0,
      latencyMs: Math.round(performance.now() - start),
      error: (err as Error).message,
    };
  }
}

// ── Fire N concurrent requests ───────────────────────────────

async function runBatch(
  count: number,
  concurrency: number,
  endpoint: string,
): Promise<RequestResult[]> {
  const results: RequestResult[] = [];
  const queue: Promise<void>[] = [];

  for (let i = 0; i < count; i++) {
    const promise = fireRequest(i, endpoint).then((r) => {
      results.push(r);
    });
    queue.push(promise);

    // Limit concurrency
    if (queue.length >= concurrency) {
      await Promise.race(queue);
      // Remove resolved promises
      for (let j = queue.length - 1; j >= 0; j--) {
        // Check if resolved by trying to race with an instant timer
        const resolved = await Promise.race([
          queue[j].then(() => true),
          new Promise<boolean>((r) => setTimeout(() => r(false), 0)),
        ]);
        if (resolved) queue.splice(j, 1);
      }
    }
  }

  // Wait for remaining
  await Promise.allSettled(queue);
  return results;
}

// ── Health Check ─────────────────────────────────────────────

async function checkHealth(): Promise<{ ok: boolean; latencyMs: number }> {
  try {
    const start = performance.now();
    const res = await fetch(`${BASE_URL}/health`, { signal: AbortSignal.timeout(5000) });
    return { ok: res.ok, latencyMs: Math.round(performance.now() - start) };
  } catch {
    return { ok: false, latencyMs: -1 };
  }
}

// ── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(60));
  console.log('💥 STRESS BOT — Crash Test');
  console.log(`   Target: ${BASE_URL}`);
  console.log(`   Max Concurrency: ${CONCURRENT}`);
  console.log('═'.repeat(60));
  console.log();

  // Pre-flight health check
  const preHealth = await checkHealth();
  console.log(
    `🏥 Pre-flight health: ${preHealth.ok ? '✅ UP' : '❌ DOWN'} (${preHealth.latencyMs}ms)`,
  );

  if (!preHealth.ok) {
    console.log('\n🔴 Server is DOWN — cannot run stress test.');
    console.log('   Start it with: cd services/ai-calling && npm run dev\n');
    process.exit(1);
  }

  const memBefore = process.memoryUsage();

  // Try voice webhook endpoint (main target)
  const endpoint = '/v1/webhooks/twilio/voice';

  const allResults: { phase: string; results: RequestResult[] }[] = [];

  for (const phase of PHASES) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(
      `📡 Phase: ${phase.name} (${phase.requests} reqs @ ${phase.concurrency} concurrent)`,
    );
    console.log('─'.repeat(50));

    const start = performance.now();
    const results = await runBatch(phase.requests, phase.concurrency, endpoint);
    const elapsed = Math.round(performance.now() - start);

    allResults.push({ phase: phase.name, results });

    const latencies = results.map((r) => r.latencyMs);
    const successes = results.filter((r) => r.status >= 200 && r.status < 500);
    const errors = results.filter((r) => r.status === 0 || r.status >= 500);

    console.log(`   ✅ Success: ${successes.length}/${results.length}`);
    console.log(`   ❌ Errors: ${errors.length}/${results.length}`);
    console.log(`   ⏱️  Elapsed: ${elapsed}ms`);
    console.log(
      `   📊 Latency: p50=${percentile(latencies, 50)}ms p95=${percentile(latencies, 95)}ms p99=${percentile(latencies, 99)}ms max=${Math.max(...latencies)}ms`,
    );

    if (errors.length > 0) {
      const uniqueErrors = [...new Set(errors.map((e) => e.error || `HTTP ${e.status}`))];
      console.log(`   🔴 Error types: ${uniqueErrors.join(', ')}`);
    }

    // Mid-flight health check
    const midHealth = await checkHealth();
    console.log(
      `   🏥 Health after phase: ${midHealth.ok ? '✅ UP' : '🔴 DOWN'} (${midHealth.latencyMs}ms)`,
    );

    if (!midHealth.ok) {
      console.log('\n🔴 SERVER CRASHED DURING STRESS TEST');
      break;
    }

    // Brief cooldown between phases
    await new Promise((r) => setTimeout(r, 500));
  }

  // Post-flight health check
  const postHealth = await checkHealth();
  const memAfter = process.memoryUsage();

  const survived = postHealth.ok;

  console.log('\n' + '═'.repeat(60));
  console.log('📋 STRESS TEST RESULTS');
  console.log('═'.repeat(60));

  const totalRequests = allResults.reduce((s, p) => s + p.results.length, 0);
  const totalErrors = allResults.reduce(
    (s, p) => s + p.results.filter((r) => r.status === 0 || r.status >= 500).length,
    0,
  );
  const allLatencies = allResults.flatMap((p) => p.results.map((r) => r.latencyMs));

  console.log(`\n   Total Requests:     ${totalRequests}`);
  console.log(`   Total Errors:       ${totalErrors}`);
  console.log(`   Error Rate:         ${((totalErrors / totalRequests) * 100).toFixed(1)}%`);
  console.log(`   p50 Latency:        ${percentile(allLatencies, 50)}ms`);
  console.log(`   p95 Latency:        ${percentile(allLatencies, 95)}ms`);
  console.log(`   p99 Latency:        ${percentile(allLatencies, 99)}ms`);
  console.log(`   Max Latency:        ${Math.max(...allLatencies)}ms`);
  console.log(`   Memory Before:      ${(memBefore.heapUsed / 1024 / 1024).toFixed(1)}MB`);
  console.log(`   Memory After:       ${(memAfter.heapUsed / 1024 / 1024).toFixed(1)}MB`);
  console.log(
    `   Memory Delta:       ${((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(1)}MB`,
  );
  console.log(`   Server Post-Test:   ${postHealth.ok ? '✅ UP' : '🔴 DOWN'}`);

  console.log('\n' + '═'.repeat(60));

  if (survived) {
    console.log('🏆 VERDICT: ✅ SURVIVED — Server stayed up under load');
  } else {
    console.log('💀 VERDICT: 🔴 CRASHED — Server went down during load test');
  }

  console.log('═'.repeat(60));

  // Write report
  const reportContent = `# 💥 Stress Test Report
> Generated: ${new Date().toISOString()}
> Target: ${BASE_URL}
> Max Concurrency: ${CONCURRENT}

## Summary

| Metric | Value |
|--------|-------|
| Total Requests | ${totalRequests} |
| Total Errors | ${totalErrors} |
| Error Rate | ${((totalErrors / totalRequests) * 100).toFixed(1)}% |
| p50 Latency | ${percentile(allLatencies, 50)}ms |
| p95 Latency | ${percentile(allLatencies, 95)}ms |
| p99 Latency | ${percentile(allLatencies, 99)}ms |
| Max Latency | ${Math.max(...allLatencies)}ms |
| Memory Delta | ${((memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024).toFixed(1)}MB |
| Server Status | ${survived ? '✅ Survived' : '🔴 Crashed'} |

## Phase Results

${allResults
  .map((p) => {
    const s = p.results.filter((r) => r.status >= 200 && r.status < 500).length;
    const e = p.results.filter((r) => r.status === 0 || r.status >= 500).length;
    const lat = p.results.map((r) => r.latencyMs);
    return `### ${p.phase}
- Requests: ${p.results.length}
- Success: ${s} | Errors: ${e}
- p50: ${percentile(lat, 50)}ms | p95: ${percentile(lat, 95)}ms | p99: ${percentile(lat, 99)}ms`;
  })
  .join('\n\n')}

## Verdict: ${survived ? '✅ SURVIVED' : '🔴 CRASHED'}
`;

  const reportPath = path.resolve(__dirname, '../STRESS_TEST_REPORT.md');
  fs.writeFileSync(reportPath, reportContent);
  console.log(`\n📄 Report written to: ${reportPath}`);
}

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
