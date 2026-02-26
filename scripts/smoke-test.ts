#!/usr/bin/env ts-node
/**
 * SMOKE TEST SCRIPT
 *
 * Quick validation of critical backend endpoints.
 * Run after deployment or backend restart to verify everything is functional.
 *
 * Usage:
 *   npx ts-node scripts/smoke-test.ts
 *   npx ts-node scripts/smoke-test.ts --base-url http://prod.example.com
 *
 * Exit codes:
 *   0 = All checks passed
 *   1 = One or more checks failed
 */

const BASE_URL = process.argv.includes('--base-url')
    ? process.argv[process.argv.indexOf('--base-url') + 1]
    : 'http://localhost:8080';

// ── Test Definitions ────────────────────────────────────────

interface SmokeTest {
    name: string;
    endpoint: string;
    method: 'GET' | 'POST';
    expectedStatus: number;
    body?: Record<string, unknown>;
    validate?: (data: any) => string | null; // return error string or null
}

const TESTS: SmokeTest[] = [
    {
        name: 'Basic Health',
        endpoint: '/health',
        method: 'GET',
        expectedStatus: 200,
    },
    {
        name: 'Detailed Health',
        endpoint: '/health/detailed',
        method: 'GET',
        expectedStatus: 200,
        validate: (data) => {
            if (!data.status) return 'Missing status field';
            if (!data.timestamp) return 'Missing timestamp field';
            if (!data.database) return 'Missing database field';
            if (!data.circuitBreakers) return 'Missing circuitBreakers field';
            return null;
        },
    },
    {
        name: 'ROI Analytics (no clinic)',
        endpoint: '/v1/analytics/roi',
        method: 'GET',
        expectedStatus: 200,
        validate: (data) => {
            // Should return zeros for missing clinic, not crash
            if (data.totalCalls30d === undefined) return 'Missing totalCalls30d';
            if (data.callSuccessRate === undefined) return 'Missing callSuccessRate';
            if (data.generatedAt === undefined) return 'Missing generatedAt';
            return null;
        },
    },
    {
        name: 'Revenue Analytics (no clinic)',
        endpoint: '/v1/analytics/revenue',
        method: 'GET',
        expectedStatus: 200,
    },
    {
        name: 'System Status',
        endpoint: '/v1/ops/system-status',
        method: 'GET',
        expectedStatus: 200,
        validate: (data) => {
            if (!data.status) return 'Missing status field';
            if (!data.dependencies) return 'Missing dependencies field';
            if (!data.metrics) return 'Missing metrics field';
            return null;
        },
    },
    {
        name: 'Playbook (invalid scenario)',
        endpoint: '/v1/ops/playbook/nonexistent',
        method: 'GET',
        expectedStatus: 404,
        validate: (data) => {
            if (!data.availableScenarios) return 'Missing availableScenarios list';
            return null;
        },
    },
    {
        name: 'Playbook (twilio_down)',
        endpoint: '/v1/ops/playbook/twilio_down',
        method: 'GET',
        expectedStatus: 200,
    },
];

// ── Runner ──────────────────────────────────────────────────

async function runTest(test: SmokeTest): Promise<{ pass: boolean; error?: string }> {
    const url = `${BASE_URL}${test.endpoint}`;

    try {
        const response = await fetch(url, {
            method: test.method,
            headers: { 'Content-Type': 'application/json' },
            body: test.body ? JSON.stringify(test.body) : undefined,
        });

        if (response.status !== test.expectedStatus) {
            return {
                pass: false,
                error: `Expected ${test.expectedStatus}, got ${response.status}`,
            };
        }

        if (test.validate) {
            const data = await response.json();
            const validationError = test.validate(data);
            if (validationError) {
                return { pass: false, error: validationError };
            }
        }

        return { pass: true };
    } catch (error) {
        return {
            pass: false,
            error: error instanceof Error ? error.message : 'Unknown fetch error',
        };
    }
}

async function main() {
    console.log(`\n🔍 SMOKE TEST — ${BASE_URL}`);
    console.log('─'.repeat(55));

    let passed = 0;
    let failed = 0;
    const failures: string[] = [];

    for (const test of TESTS) {
        const result = await runTest(test);
        if (result.pass) {
            console.log(`  ✅ ${test.name}`);
            passed++;
        } else {
            console.log(`  ❌ ${test.name} — ${result.error}`);
            failures.push(`${test.name}: ${result.error}`);
            failed++;
        }
    }

    console.log('─'.repeat(55));
    console.log(`  ${passed} passed, ${failed} failed, ${TESTS.length} total\n`);

    if (failed > 0) {
        console.log('  FAILURES:');
        failures.forEach((f) => console.log(`    ⚠️  ${f}`));
        console.log('');
        process.exit(1);
    } else {
        console.log('  All smoke tests passed! ✅\n');
        process.exit(0);
    }
}

main();
