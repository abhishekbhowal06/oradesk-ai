/**
 * Load Test Script
 * 
 * Uses Node.js built-in to simulate concurrent requests.
 * Run with: node tests/load/load-test.js
 */

const API_BASE = process.env.API_URL || 'http://localhost:8080';
const CONCURRENT_USERS = 100;
const REQUESTS_PER_USER = 10;

async function makeRequest(userId, requestId) {
    const start = Date.now();
    try {
        const response = await fetch(`${API_BASE}/health`);
        const duration = Date.now() - start;
        return {
            success: response.ok,
            status: response.status,
            duration,
            userId,
            requestId
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            duration: Date.now() - start,
            userId,
            requestId
        };
    }
}

async function runUserSession(userId) {
    const results = [];
    for (let i = 0; i < REQUESTS_PER_USER; i++) {
        results.push(await makeRequest(userId, i));
    }
    return results;
}

async function runLoadTest() {
    console.log(`\n🚀 Starting load test...`);
    console.log(`   Concurrent users: ${CONCURRENT_USERS}`);
    console.log(`   Requests per user: ${REQUESTS_PER_USER}`);
    console.log(`   Total requests: ${CONCURRENT_USERS * REQUESTS_PER_USER}`);
    console.log(`   Target: ${API_BASE}\n`);

    const startTime = Date.now();

    // Create all user sessions
    const userPromises = [];
    for (let i = 0; i < CONCURRENT_USERS; i++) {
        userPromises.push(runUserSession(i));
    }

    // Wait for all to complete
    const allResults = await Promise.all(userPromises);
    const flatResults = allResults.flat();

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    // Calculate metrics
    const successfulRequests = flatResults.filter(r => r.success).length;
    const failedRequests = flatResults.filter(r => !r.success).length;
    const durations = flatResults.map(r => r.duration);
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);
    const p95Duration = durations.sort((a, b) => a - b)[Math.floor(durations.length * 0.95)];
    const requestsPerSecond = (flatResults.length / (totalDuration / 1000)).toFixed(2);

    console.log(`\n📊 RESULTS`);
    console.log(`${'─'.repeat(40)}`);
    console.log(`Total time:        ${totalDuration}ms`);
    console.log(`Requests/sec:      ${requestsPerSecond}`);
    console.log(`${'─'.repeat(40)}`);
    console.log(`Successful:        ${successfulRequests}`);
    console.log(`Failed:            ${failedRequests}`);
    console.log(`Success rate:      ${((successfulRequests / flatResults.length) * 100).toFixed(1)}%`);
    console.log(`${'─'.repeat(40)}`);
    console.log(`Avg latency:       ${avgDuration.toFixed(0)}ms`);
    console.log(`Min latency:       ${minDuration}ms`);
    console.log(`Max latency:       ${maxDuration}ms`);
    console.log(`P95 latency:       ${p95Duration}ms`);
    console.log(`${'─'.repeat(40)}\n`);

    if (failedRequests > 0) {
        console.log(`⚠️  ${failedRequests} requests failed`);
        process.exit(1);
    } else if (avgDuration > 500) {
        console.log(`⚠️  Average latency exceeds 500ms threshold`);
    } else {
        console.log(`✅ Load test passed!`);
    }
}

runLoadTest().catch(console.error);
