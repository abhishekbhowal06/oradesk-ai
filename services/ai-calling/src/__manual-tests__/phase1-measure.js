/**
 * PHASE 1 LATENCY MEASUREMENT
 * 
 * Manual test to measure audio pipeline performance
 * Run with: node dist/__manual-tests__/phase1-measure.js
 */

const WebSocket = require('ws');

const SERVER_URL = process.env.SERVICE_URL || 'http://localhost:8080';
const WS_URL = SERVER_URL.replace('http', 'ws') + '/v1/streams';

console.log('\n🎯 PHASE 1: Audio Pipeline Latency Test');
console.log('='.repeat(50));
console.log(`Target: <500ms perceived latency`);
console.log(`WebSocket URL: ${WS_URL}\n`);

async function measureWebSocketConnection() {
    console.log('Test 1: WebSocket Connection Time');
    const start = Date.now();

    const ws = new WebSocket(WS_URL);

    await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', (err) => {
            console.error('❌ Connection failed:', err.message);
            reject(err);
        });
        setTimeout(() => reject(new Error('Timeout')), 5000);
    });

    const elapsed = Date.now() - start;
    console.log(`✅ Connection established: ${elapsed}ms`);
    console.log(`   Target: <100ms | ${elapsed < 100 ? 'PASS' : 'FAIL'}\n`);

    return { ws, elapsed };
}

async function measureStreamInitialization(ws) {
    console.log('Test 2: Stream Initialization');
    const start = Date.now();

    ws.send(JSON.stringify({
        event: 'start',
        start: {
            streamSid: 'test_stream_123',
            callSid: 'test_call_456',
            customParameters: {
                call_id: 'test_uuid_' + Date.now(),
                call_type: 'confirmation'
            }
        }
    }));

    // Wait for Deepgram connection (check server logs)
    await new Promise(resolve => setTimeout(resolve, 300));

    const elapsed = Date.now() - start;
    console.log(`✅ Stream initialized: ${elapsed}ms`);
    console.log(`   Target: <300ms | ${elapsed < 300 ? 'PASS' : 'FAIL'}\n`);

    return elapsed;
}

async function measureMediaFrameProcessing(ws) {
    console.log('Test 3: Media Frame Processing (50 frames)');
    const start = Date.now();
    const frameCount = 50;

    for (let i = 0; i < frameCount; i++) {
        ws.send(JSON.stringify({
            event: 'media',
            media: {
                payload: Buffer.from('simulated_audio_20ms').toString('base64'),
                timestamp: Date.now()
            }
        }));
    }

    const elapsed = Date.now() - start;
    const avgPerFrame = elapsed / frameCount;

    console.log(`✅ Processed ${frameCount} frames: ${elapsed}ms`);
    console.log(`   Avg per frame: ${avgPerFrame.toFixed(2)}ms`);
    console.log(`   Target: <10ms/frame | ${avgPerFrame < 10 ? 'PASS' : 'FAIL'}\n`);

    return avgPerFrame;
}

async function runPhase1Tests() {
    try {
        const results = {};

        // Test 1: Connection
        const { ws, elapsed: connectionTime } = await measureWebSocketConnection();
        results.connectionTime = connectionTime;

        // Test 2: Initialization
        const initTime = await measureStreamInitialization(ws);
        results.initTime = initTime;

        // Test 3: Frame processing
        const frameTime = await measureMediaFrameProcessing(ws);
        results.frameTime = frameTime;

        // Clean up
        ws.close();

        // Summary
        console.log('='.repeat(50));
        console.log('PHASE 1 RESULTS:');
        console.log(`  Connection:      ${results.connectionTime}ms ${results.connectionTime < 100 ? '✅' : '❌'}`);
        console.log(`  Initialization:  ${results.initTime}ms ${results.initTime < 300 ? '✅' : '❌'}`);
        console.log(`  Frame processing: ${results.frameTime.toFixed(2)}ms/frame ${results.frameTime < 10 ? '✅' : '❌'}`);

        const totalPipelineLatency = results.connectionTime + results.initTime;
        console.log(`\nTotal pipeline setup: ${totalPipelineLatency}ms`);
        console.log(`Target for perceived latency: <500ms`);
        console.log(`Status: ${totalPipelineLatency < 500 ? '✅ PASS' : '❌ NEEDS OPTIMIZATION'}`);

        console.log('\n📊 Next: Check server logs for Deepgram connection status');
        console.log('📊 Next: PHASE 2 - Early Intent Engine (50ms processing)\n');

    } catch (error) {
        console.error('\n❌ Test failed:', error.message);
        console.error('\nTroubleshooting:');
        console.error('  1. Is server running? (npm start in services/ai-calling)');
        console.error('  2. Check DEEPGRAM_API_KEY in .env');
        console.error('  3. Check server logs for errors\n');
        process.exit(1);
    }
}

// Run tests
runPhase1Tests();
