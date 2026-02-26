// Custom Load Test Harness for OraDesk AI
// Simulates 100 concurrent calls and 1000 webhook events to verify Phase 1 constraints

const API_URL = 'http://127.0.0.1:3000/v1';

async function runLoadTest() {
    console.log('🚀 Starting Extreme Load Test...');
    console.log('--------------------------------------------------');

    const callStartTime = Date.now();
    console.log('📞 Initiating 100 Concurrent Call Requests across 50 simulated clinics...');

    // Create 100 concurrent call promises
    const callPromises = Array.from({ length: 100 }).map(async (_, i) => {
        const clinicId = `clinic_${(i % 50) + 1}`; // 50 clinics
        try {
            const res = await fetch(`${API_URL}/calls/outbound`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer test-token-123'
                },
                body: JSON.stringify({
                    clinicId,
                    patientId: `pat_${i}`,
                    objective: 'TEST'
                })
            });
            if (!res.ok) {
                console.log(`[HTTP ERROR] Call responded with ${res.status}: ${await res.text()}`);
            }
            return res.status;
        } catch (e) {
            console.log(`[FETCH ERROR] Call failed: ${e.message}`);
            return 500;
        }
    });

    const callResults = await Promise.all(callPromises);
    const callTime = Date.now() - callStartTime;

    // Aggregate call results
    const callStatusCounts = callResults.reduce((acc, status) => {
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});

    console.log(`✅ Calls Test Finished in ${callTime}ms`);
    console.log('📊 Call Response Status Distribution:', callStatusCounts);
    if (callStatusCounts['429']) {
        console.log('🛡️ RATE LIMITER ACTIVATED: Successfully blocked excess call traffic!');
    }

    console.log('\n--------------------------------------------------\n');

    const webhookStartTime = Date.now();
    console.log('⚡ Initiating 1000 Concurrent Webhook Events...');

    // Create 1000 concurrent webhook promises
    const webhookPromises = Array.from({ length: 1000 }).map(async (_, i) => {
        try {
            const res = await fetch(`${API_URL}/webhooks/stripe`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: `evt_test_${i}_${Date.now()}`,
                    type: 'invoice.payment_succeeded',
                    data: { object: { customer: 'cus_test123' } }
                })
            });
            if (!res.ok) {
                console.log(`[HTTP ERROR] Webhook responded with ${res.status}: ${await res.text()}`);
            }
            return res.status;
        } catch (e) {
            console.log(`[FETCH ERROR] Webhook failed: ${e.message}`);
            return 500;
        }
    });

    const webhookResults = await Promise.all(webhookPromises);
    const webhookTime = Date.now() - webhookStartTime;

    // Aggregate webhook results
    const webhookStatusCounts = webhookResults.reduce((acc, status) => {
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});

    console.log(`✅ Webhooks Test Finished in ${webhookTime}ms`);
    console.log('📊 Webhook Response Status Distribution:', webhookStatusCounts);
    if (webhookStatusCounts['429']) {
        console.log('🛡️ RATE LIMITER ACTIVATED: Successfully blocked webhook flooding/DDoS!');
    }

    console.log('\n--------------------------------------------------');
    console.log('🏆 END OF LOAD TEST');
}

runLoadTest().catch(console.error);
