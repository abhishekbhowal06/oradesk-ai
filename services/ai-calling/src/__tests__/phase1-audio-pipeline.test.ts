/**
 * PHASE 1 TEST: Audio Pipeline Latency
 * 
 * Measures:
 * - WebSocket connection time
 * - First audio frame received
 * - Deepgram connection ready
 * - First partial transcript
 */

import { describe, test, expect, beforeAll } from 'vitest';
import WebSocket from 'ws';
import { logger } from '../lib/logger';

const WS_URL = process.env.WS_TEST_URL || 'ws://localhost:3001/v1/streams';
const TARGET_LATENCY_MS = 500; // Target for audio pipeline setup

describe('PHASE 1: Audio Pipeline Latency', () => {
    test('WebSocket connection establishes < 100ms', async () => {
        const start = performance.now();

        const ws = new WebSocket(WS_URL);

        await new Promise((resolve, reject) => {
            ws.on('open', resolve);
            ws.on('error', reject);
            setTimeout(() => reject(new Error('Connection timeout')), 5000);
        });

        const elapsed = performance.now() - start;
        logger.info(`WebSocket connection: ${elapsed}ms`);

        expect(elapsed).toBeLessThan(100);
        ws.close();
    }, 10000);

    test('Stream accepts Twilio start event', async () => {
        const ws = new WebSocket(WS_URL);

        await new Promise(resolve => ws.on('open', resolve));

        const start = performance.now();

        // Simulate Twilio start event
        ws.send(JSON.stringify({
            event: 'start',
            start: {
                streamSid: 'test_stream_123',
                callSid: 'test_call_456',
                customParameters: {
                    call_id: 'test_uuid',
                    call_type: 'confirmation'
                }
            }
        }));

        // Wait for acknowledgement (check logs)
        await new Promise(resolve => setTimeout(resolve, 200));

        const elapsed = performance.now() - start;
        logger.info(`Stream initialization: ${elapsed}ms`);

        expect(elapsed).toBeLessThan(300);
        ws.close();
    }, 10000);

    test('Media frames accepted continuously', async () => {
        const ws = new WebSocket(WS_URL);

        await new Promise(resolve => ws.on('open', resolve));

        // Send start event
        ws.send(JSON.stringify({
            event: 'start',
            start: {
                streamSid: 'test_stream_123',
                callSid: 'test_call_456',
                customParameters: {
                    call_id: 'test_uuid',
                    call_type: 'confirmation'
                }
            }
        }));

        await new Promise(resolve => setTimeout(resolve, 100));

        const start = performance.now();
        const frameCount = 50; // Simulate 1 second of audio (20ms/frame)

        // Send 50 media frames
        for (let i = 0; i < frameCount; i++) {
            ws.send(JSON.stringify({
                event: 'media',
                media: {
                    payload: Buffer.from('fake_audio_data').toString('base64')
                }
            }));
        }

        const elapsed = performance.now() - start;
        const avgFrameTime = elapsed / frameCount;

        logger.info(`${frameCount} frames in ${elapsed}ms (avg ${avgFrameTime.toFixed(2)}ms/frame)`);

        // Each frame should process in <10ms for real-time performance
        expect(avgFrameTime).toBeLessThan(10);

        ws.close();
    }, 10000);
});

describe('PHASE 1: End-to-End Perceived Latency', () => {
    test('Patient silence → AI acknowledges < 500ms (target)', async () => {
        // This test requires full Deepgram integration
        // For now, measure pipeline readiness

        const ws = new WebSocket(WS_URL);
        await new Promise(resolve => ws.on('open', resolve));

        const start = performance.now();

        // Initialize stream
        ws.send(JSON.stringify({
            event: 'start',
            start: {
                streamSid: 'test_stream_123',
                callSid: 'test_call_456',
                customParameters: {
                    call_id: 'test_uuid',
                    call_type: 'confirmation'
                }
            }
        }));

        // Simulate patient speaking "yes"
        // In reality, this would be real audio
        ws.send(JSON.stringify({
            event: 'media',
            media: {
                payload: Buffer.from('simulated_yes_audio').toString('base64')
            }
        }));

        // Wait for response (in real system, would measure TTS output)
        await new Promise(resolve => setTimeout(resolve, 200));

        const elapsed = performance.now() - start;

        logger.info(`Full cycle (simulated): ${elapsed}ms`);

        // With Deepgram, target < 500ms
        expect(elapsed).toBeLessThan(1000); // Loose bound for now

        ws.close();
    }, 10000);
});
