import WebSocket from 'ws';
import http from 'http';
import dotenv from 'dotenv';
dotenv.config();

const CONCURRENT_CLIENTS = 10;
const DURATION_MS = 5000;
const PORTS = [3000, 8080];

async function checkHealth(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function runLoadTest() {
  console.log('🔍 Detecting running server...');
  let activePort = 0;

  for (const port of PORTS) {
    if (await checkHealth(port)) {
      activePort = port;
      console.log(`✅ Server detected on port ${port}`);
      break;
    }
  }

  if (!activePort) {
    console.error('❌ FAILURE: Could not detect running server on port 3000 or 8080.');
    console.error('   Please run `npm run dev` in a separate terminal.');
    process.exit(1);
  }

  const WS_URL = `ws://localhost:${activePort}/v1/streams`;
  console.log(`🚀 Starting Load Test: ${CONCURRENT_CLIENTS} clients connecting to ${WS_URL}`);

  const clients: WebSocket[] = [];
  let connectedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < CONCURRENT_CLIENTS; i++) {
    const ws = new WebSocket(WS_URL);

    ws.on('open', () => {
      connectedCount++;
      ws.send(
        JSON.stringify({
          event: 'start',
          start: { streamSid: `test_stream_${i}`, callSid: `test_call_${i}` },
        }),
      );
    });

    ws.on('error', () => {
      errorCount++;
    });

    clients.push(ws);
    await new Promise((r) => setTimeout(r, 20));
  }

  setTimeout(() => {
    console.log(`\n📊 Stats after ${DURATION_MS}ms:`);
    console.log(`   Connected: ${connectedCount}/${CONCURRENT_CLIENTS}`);
    console.log(`   Errors: ${errorCount}`);

    clients.forEach((ws) => ws.close());

    if (connectedCount === 0) {
      console.error('❌ FAILURE: No connections succeeded.');
      process.exit(1);
    } else {
      console.log('✅ SUCCESS: Websocket load test passed.');
      process.exit(0);
    }
  }, DURATION_MS);
}

runLoadTest();
