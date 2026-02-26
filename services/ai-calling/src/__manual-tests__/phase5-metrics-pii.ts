import { metricsRegistry } from '../lib/metrics';
import { redactForLogging } from '../lib/pii-redaction';

async function testPhase5() {
    console.log('--- Phase 5: Reliability & Observability Test ---');

    console.log('\n[1] Testing Prometheus Metrics...');
    try {
        const metricsOutput = await metricsRegistry.metrics();
        if (metricsOutput.includes('clinic_os_calls_handled_total') && metricsOutput.includes('clinic_os_circuit_breaker_trips_total')) {
            console.log('✅ Prometheus metrics registry actively configured and exporting correctly.');
            console.log(metricsOutput.split('\n').slice(0, 10).join('\n') + '\n...');
        } else {
            console.error('❌ Metrics missing expected metric keys.');
            process.exit(1);
        }
    } catch (e) {
        console.error('❌ Failed to retrieve metrics:', e);
        process.exit(1);
    }

    console.log('\n[2] Testing Fortified PII Scrubber (SSN & Names)...');

    // Test cases that MUST be scrubbed for logs
    const testLines = [
        "Patient John Smith requested an appointment on May 12, 2024.",
        "The social security number is 123-456-7890 for the verification.",
        "Another SSN format: 987 65 4321 and 123456789.",
        "My phone number is 313-555-0192 and I live at 123 Main Street.",
    ];

    let passed = true;
    for (const line of testLines) {
        const scrubbed = redactForLogging(line);
        console.log(`Original: ${line}`);
        console.log(`Scrubbed: ${scrubbed}`);

        // Assertions
        if (scrubbed.includes('John') || scrubbed.includes('Smith')) {
            console.error('❌ Failed to scrub full name!');
            passed = false;
        }
        if (scrubbed.includes('123-456-7890') || scrubbed.includes('987 65 4321')) {
            console.error('❌ Failed to scrub SSN!');
            passed = false;
        }
        if (scrubbed.includes('313-555-0192')) {
            console.error('❌ Failed to scrub Phone Number!');
            passed = false;
        }
    }

    if (passed) {
        console.log('\n✅ PII scrubber correctly redacts names, SSNs, and phone numbers before logging.');
    } else {
        process.exit(1);
    }

    console.log('\nTest completed successfully.');
}

testPhase5();
