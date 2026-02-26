/**
 * SIMPLE WEBSOCKET CONNECTION TEST
 */

const WebSocket = require('ws');

const WS_URL = 'ws://localhost:8080/v1/streams';

console.log('\nTesting WebSocket connection to:', WS_URL);
console.log('Attempting connection...\n');

const ws = new WebSocket(WS_URL);

ws.on('error', (error) => {
  console.error('❌ Connection Error:', error.code || error.message);
  console.error('\nPossible causes:');
  console.error('  - Server not running on port 8080');
  console.error('  - WebSocket path incorrect');
  console.error('  - Firewall blocking connection\n');
  process.exit(1);
});

ws.on('open', () => {
  console.log('✅ WebSocket connected successfully!');
  console.log('✅ Server is accepting streaming connections');
  console.log('\n Sending test start message...');

  ws.send(
    JSON.stringify({
      event: 'start',
      start: {
        streamSid: 'test_123',
        callSid: 'call_456',
        customParameters: {
          call_id: 'test_789',
          call_type: 'test',
        },
      },
    }),
  );

  console.log('✅ Message sent');

  setTimeout(() => {
    console.log('\n✅ WebSocket test PASSED');
    console.log('   Server is ready for streaming audio\n');
    ws.close();
    process.exit(0);
  }, 1000);
});

ws.on('close', () => {
  console.log('Connection closed');
});

// Timeout
setTimeout(() => {
  console.error('\n❌ Connection timeout after 5 seconds');
  console.error('   Server may not be listening on ws://localhost:8080/v1/streams\n');
  process.exit(1);
}, 5000);
