/**
 * MOCK PMS BRIDGE SERVICE
 * Simulates a local Windows Service connected to OpenDental MySQL.
 *
 * Usage: node index.js
 */

const http = require('http');
const crypto = require('crypto');

const PORT = 3001;
const CLINIC_ID = 'your-clinic-uuid';

// Simulated In-Memory Database (Reset on restart)
const appointments = [];

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const { method, url } = req;

  // 1. GET /slots (Query Availability)
  if (method === 'GET' && url.startsWith('/slots')) {
    console.log(`[PMS BRIDGE] Querying OpenDental Availability...`);

    // Simulate DB Latency
    setTimeout(() => {
      const mockSlots = [
        { start: getNextDate(1, 10), end: getNextDate(1, 11), provider: 'DOC1' },
        { start: getNextDate(1, 14), end: getNextDate(1, 15), provider: 'DOC1' },
        { start: getNextDate(2, 9), end: getNextDate(2, 10), provider: 'HYG1' },
        { start: getNextDate(3, 11), end: getNextDate(3, 12), provider: 'DOC2' },
      ];

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(mockSlots));
    }, 500);
  }

  // 2. POST /appointments (Write Back)
  else if (method === 'POST' && url === '/appointments') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        console.log(`[PMS BRIDGE] 🔒 Locking Table 'appointment'...`);
        console.log(
          `[PMS BRIDGE] INSERT INTO appointment (PatNum, AptDateTime) VALUES (${data.patient_id}, '${data.start_time}')`,
        );

        // Simulate occasional random failure (Network blip)
        if (Math.random() < 0.1) {
          throw new Error('Simulated Database Timeout');
        }

        const aptId = crypto.randomInt(10000, 99999);
        appointments.push({ id: aptId, ...data });

        console.log(`[PMS BRIDGE] ✅ Success! AptNum: ${aptId}`);

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            success: true,
            appointment_id: aptId,
            message: 'Inserted into OpenDental',
          }),
        );
      } catch (err) {
        console.error(`[PMS BRIDGE] ❌ Error: ${err.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Endpoint not found' }));
  }
});

// Helper to get future dates
function getNextDate(daysAhead, hour) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

server.listen(PORT, () => {
  console.log(`
  ===========================================
   🏥 OPEN DENTAL LOCAL BRIDGE (MOCK) v1.0
   Running on port ${PORT}
   Simulating MySQL Connection... [OK]
  ===========================================
  `);
});
