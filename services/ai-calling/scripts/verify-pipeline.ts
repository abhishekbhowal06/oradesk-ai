import WebSocket from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const WS_URL = 'ws://localhost:8080/v1/streams';

async function testVoicePipeline() {
  console.log(`Connecting to ${WS_URL}...`);
  const ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    console.log('✅ Connected to WebSocket');

    // Simulate Twilio 'start' event
    const startMsg = {
      event: 'start',
      start: {
        streamSid: 'MZ1234567890',
        callSid: 'CA1234567890',
        customParameters: {
          call_id: 'test_call_123',
        },
      },
    };
    ws.send(JSON.stringify(startMsg));
    console.log('Sent start event');

    // Send dummy audio (silence)
    // In a real verification, we'd send valid mu-law audio
    const silence = Buffer.alloc(160).toString('base64');
    const mediaMsg = {
      event: 'media',
      media: {
        payload: silence,
      },
    };

    // Send a few chunks
    let count = 0;
    const interval = setInterval(() => {
      if (count > 5) {
        clearInterval(interval);
        ws.close();
        return;
      }
      ws.send(JSON.stringify(mediaMsg));
      count++;
    }, 100);
  });

  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('📩 Received:', msg.event);
    if (msg.event === 'media') {
      console.log('   (Audio Chunk Received)');
    }
    if (msg.event === 'mark') {
      console.log(`   (Mark: ${msg.mark.name})`);
    }
  });

  ws.on('close', () => {
    console.log('❌ Disconnected');
  });

  ws.on('error', (err) => {
    console.error('WebSocket Error:', err);
  });
}

testVoicePipeline();
