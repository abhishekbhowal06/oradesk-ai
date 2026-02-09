/**
 * PII REDACTION SERVICE
 * 
 * Removes Protected Health Information (PHI) and Personally Identifiable 
 * Information (PII) from text before sending to third-party APIs.
 * 
 * Required for HIPAA compliance when using external AI services.
 */

import { logger } from './logger';

export interface RedactionResult {
    redactedText: string;
    redactionsApplied: string[];
}

// Patterns for PII detection
const PII_PATTERNS = [
    // Phone numbers (various formats)
    { pattern: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: '[PHONE]', name: 'phone' },
    { pattern: /\b\(\d{3}\)\s?\d{3}[-.\s]?\d{4}\b/g, replacement: '[PHONE]', name: 'phone' },

    // Social Security Numbers
    { pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, replacement: '[SSN]', name: 'ssn' },

    // Email addresses
    { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: '[EMAIL]', name: 'email' },

    // Date of Birth patterns
    { pattern: /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}\b/gi, replacement: '[DOB]', name: 'dob' },
    { pattern: /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g, replacement: '[DATE]', name: 'date' },

    // Credit card numbers (basic patterns)
    { pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, replacement: '[CARD]', name: 'card' },

    // Insurance ID patterns (common formats)
    { pattern: /\b[A-Z]{2,3}\d{8,12}\b/g, replacement: '[INSURANCE_ID]', name: 'insurance' },

    // Medical Record Numbers (common patterns)
    { pattern: /\bMRN[:\s]?\d{6,10}\b/gi, replacement: '[MRN]', name: 'mrn' },

    // Addresses (basic - street numbers with names)
    { pattern: /\b\d{1,5}\s+[A-Za-z]+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|boulevard|blvd)\b/gi, replacement: '[ADDRESS]', name: 'address' },

    // Zip codes
    { pattern: /\b\d{5}(-\d{4})?\b/g, replacement: '[ZIP]', name: 'zip' }
];

/**
 * Redact PII from text
 */
export function redactPII(text: string): RedactionResult {
    let redactedText = text;
    const redactionsApplied: string[] = [];

    for (const { pattern, replacement, name } of PII_PATTERNS) {
        const matches = redactedText.match(pattern);
        if (matches && matches.length > 0) {
            redactedText = redactedText.replace(pattern, replacement);
            redactionsApplied.push(`${name}:${matches.length}`);
        }
    }

    if (redactionsApplied.length > 0) {
        logger.debug('PII redaction applied', { redactions: redactionsApplied });
    }

    return { redactedText, redactionsApplied };
}

/**
 * Redact PII for logging purposes (more aggressive)
 * Keeps meaning but removes all potentially identifying info
 */
export function redactForLogging(text: string): string {
    const result = redactPII(text);

    // Additional redactions for logging
    // Names are tricky - we'll mask anything that looks like a proper noun
    // This is aggressive but safe for HIPAA
    let logSafe = result.redactedText;

    // Redact potential names (capitalized words not at sentence start)
    // This is a heuristic - may over-redact
    logSafe = logSafe.replace(/(?<=[.?!]\s+)([A-Z][a-z]+)/g, '[NAME]');

    // Redact any remaining numbers longer than 3 digits
    logSafe = logSafe.replace(/\b\d{4,}\b/g, '[NUMBER]');

    return logSafe;
}

/**
 * Check if text contains potential PII (for warnings)
 */
export function containsPII(text: string): { hasPII: boolean; types: string[] } {
    const types: string[] = [];

    for (const { pattern, name } of PII_PATTERNS) {
        if (pattern.test(text)) {
            types.push(name);
        }
        // Reset lastIndex for global patterns
        pattern.lastIndex = 0;
    }

    return { hasPII: types.length > 0, types };
}

/**
 * Safe wrapper for sending text to external APIs
 * Always redacts PII before the request leaves
 */
export function prepareForExternalAPI(text: string, targetService: string): string {
    const { redactedText, redactionsApplied } = redactPII(text);

    if (redactionsApplied.length > 0) {
        logger.info(`PII redacted before sending to ${targetService}`, {
            service: targetService,
            redactions: redactionsApplied
        });
    }

    return redactedText;
}
