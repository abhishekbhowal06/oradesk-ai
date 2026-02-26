/**
 * ALERTING MODULE (PagerDuty)
 * 
 * Handles routing critical system alerts to the engineering on-call rotation.
 * Integrated with the Circuit Breaker to notify humans immediately when 
 * cascading failures (like Stripe, Twilio, or Gemini outages) are detected.
 */

import { logger } from './logging/structured-logger';

// V2 Events API Endpoint
const PAGERDUTY_EVENTS_API = 'https://events.pagerduty.com/v2/enqueue';

export interface IncidentData {
    serviceName: string;
    description: string;
    details?: Record<string, any>;
    severity?: 'critical' | 'error' | 'warning' | 'info';
}

export async function alertEngineers(incident: IncidentData): Promise<void> {
    const routingKey = process.env.PAGERDUTY_ROUTING_KEY;

    // Log the alert regardless of whether PagerDuty is configured
    logger.error(`[ALERT TRIGGERED] ${incident.serviceName} - ${incident.description}`, {
        ...incident.details,
        alertSeverity: incident.severity || 'critical'
    });

    if (!routingKey) {
        logger.warn('Skipping PagerDuty alert: PAGERDUTY_ROUTING_KEY is not set.');
        return;
    }

    try {
        const payload = {
            routing_key: routingKey,
            event_action: 'trigger',
            payload: {
                summary: `[OraDesk Production] ${incident.serviceName} Outage Detected`,
                source: 'oradesk-ai-gateway',
                severity: incident.severity || 'critical',
                component: incident.serviceName,
                custom_details: incident.details || {}
            }
        };

        const response = await fetch(PAGERDUTY_EVENTS_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`PagerDuty API responded with status ${response.status}: ${errorText}`);
        }

        logger.info('Successfully dispatched PagerDuty alert', { service: incident.serviceName });
    } catch (error) {
        logger.error('Failed to dispatch PagerDuty alert', { error: (error as Error).message });
    }
}
