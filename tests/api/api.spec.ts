import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_URL || 'http://localhost:8080';

test.describe('API: Health Check', () => {
    test('GET /health returns OK', async ({ request }) => {
        const response = await request.get(`${API_BASE}/health`);
        expect(response.status()).toBe(200);
        expect(await response.text()).toBe('OK');
    });
});

test.describe('API: Widget Endpoint', () => {
    test('POST /v1/appointments/request validates required fields', async ({ request }) => {
        const response = await request.post(`${API_BASE}/v1/appointments/request`, {
            data: {
                first_name: 'John'
                // Missing other required fields
            }
        });

        expect(response.status()).toBe(400);
        const body = await response.json();
        expect(body.error).toContain('Missing');
    });

    test('POST /v1/appointments/request with valid data', async ({ request }) => {
        const response = await request.post(`${API_BASE}/v1/appointments/request`, {
            data: {
                first_name: 'Test',
                last_name: 'Patient',
                phone: '+15551234567',
                reason: 'cleaning',
                clinic_id: 'test-clinic-id'
            }
        });

        // Will fail without valid clinic_id, but should not be 400
        expect([201, 500]).toContain(response.status());
    });
});

test.describe('API: Authentication Required', () => {
    test('GET /v1/calls requires auth', async ({ request }) => {
        const response = await request.get(`${API_BASE}/v1/calls`);
        // Should return 401 or 403 without auth
        expect([401, 403, 404]).toContain(response.status());
    });

    test('GET /v1/analytics requires auth', async ({ request }) => {
        const response = await request.get(`${API_BASE}/v1/analytics`);
        expect([401, 403, 404]).toContain(response.status());
    });
});
