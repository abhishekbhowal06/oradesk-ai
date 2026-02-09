/**
 * Safety Boundaries Module
 * 
 * Core patient safety enforcement for Dentacore AI Calling.
 * Implements emergency detection, prohibited topic filtering,
 * and AI disclosure requirements.
 */

// Emergency phrases that trigger immediate human escalation
export const EMERGENCY_PHRASES = [
    // Pain indicators
    'pain', 'hurts', 'hurting', 'painful', 'severe pain', 'intense pain',
    'excruciating', 'agony', 'throbbing',
    // Medical emergencies
    'bleeding', 'blood', 'swelling', 'swollen', 'infection', 'infected',
    'fever', 'emergency', 'urgent', 'hospital', 'er', 'emergency room',
    // Trauma
    'accident', 'injured', 'fell', 'hit', 'broken', 'cracked', 'knocked out',
    'chipped', 'trauma',
    // Distress signals
    'can\'t breathe', 'difficulty breathing', 'choking', 'allergic reaction',
    'passed out', 'fainted', 'unconscious', 'dizzy',
    // Dental emergencies
    'abscess', 'pus', 'tooth fell out', 'tooth knocked out',
    'jaw locked', 'can\'t open mouth', 'can\'t close mouth',
    // Emotional distress
    'scared', 'terrified', 'panic', 'crying', 'help me'
];

// Phrases indicating patient may need immediate medical attention
export const CRITICAL_ESCALATION_PHRASES = [
    'call 911', 'ambulance', 'dying', 'heart', 'chest pain',
    'stroke', 'seizure', 'overdose'
];

// Topics AI must NEVER discuss
export const PROHIBITED_TOPICS = [
    // Diagnosis
    'diagnose', 'diagnosis', 'what is wrong', 'what do i have',
    'is it cancer', 'is it serious', 'you have', 'sounds like you',
    'i think you have', 'looks like', 'appears to be', 'what disease',
    // Medical advice
    'should i take', 'what medication', 'what medicine', 'prescription',
    'prescribe', 'antibiotic', 'painkiller', 'ibuprofen', 'advil', 'tylenol',
    'mg', 'milligram', 'twice daily', 'three times', 'dosage',
    // Treatment promises
    'will it hurt', 'how long will', 'will the doctor',
    'guarantee', 'promise', 'definitely', 'for sure',
    // Cost/Insurance specifics
    'how much will it cost', 'exact price', 'insurance cover',
    'out of pocket', 'costs $', 'cost $', '$ ', 'dollars'
];

// AI Disclosure script - MUST be spoken at every call start
export const AI_DISCLOSURE_SCRIPT =
    "Hello, this is an automated call from your dental practice. " +
    "I'm an AI assistant helping with appointment management. " +
    "If you need to speak with a person at any time, just say 'speak to someone'.";

// Escalation response when emergency detected
export const EMERGENCY_ESCALATION_SCRIPT =
    "I understand this may be urgent. I'm connecting you to our staff right now. " +
    "Please stay on the line. If this is a medical emergency, please hang up and call 911.";

// Human handoff phrases patients can use
export const HUMAN_HANDOFF_PHRASES = [
    'speak to someone', 'speak to a person', 'talk to a human',
    'talk to someone', 'real person', 'human please', 'receptionist',
    'transfer me', 'get me a person', 'operator'
];

export interface SafetyCheckResult {
    safe: boolean;
    reason?: string;
    escalationType?: 'emergency' | 'human_request' | 'prohibited_topic';
    detectedPhrase?: string;
}

/**
 * Check if transcript contains emergency phrases requiring immediate escalation
 */
export function checkEmergency(transcript: string): SafetyCheckResult {
    const normalizedTranscript = transcript.toLowerCase().trim();

    // Check for critical emergencies first (highest priority)
    for (const phrase of CRITICAL_ESCALATION_PHRASES) {
        if (normalizedTranscript.includes(phrase)) {
            return {
                safe: false,
                reason: 'Critical emergency detected - immediate escalation required',
                escalationType: 'emergency',
                detectedPhrase: phrase
            };
        }
    }

    // Check for emergency phrases
    for (const phrase of EMERGENCY_PHRASES) {
        if (normalizedTranscript.includes(phrase)) {
            return {
                safe: false,
                reason: 'Emergency phrase detected - human escalation required',
                escalationType: 'emergency',
                detectedPhrase: phrase
            };
        }
    }

    // Check for human handoff requests
    for (const phrase of HUMAN_HANDOFF_PHRASES) {
        if (normalizedTranscript.includes(phrase)) {
            return {
                safe: false,
                reason: 'Patient requested human assistance',
                escalationType: 'human_request',
                detectedPhrase: phrase
            };
        }
    }

    return { safe: true };
}

/**
 * Check if AI response attempts to discuss prohibited topics
 */
export function checkProhibitedTopics(input: string): SafetyCheckResult {
    const normalized = input.toLowerCase();

    // Check for prohibited phrases
    for (const topic of PROHIBITED_TOPICS) {
        if (normalized.includes(topic)) {
            return {
                safe: false,
                reason: 'Content contains prohibited topic',
                escalationType: 'prohibited_topic',
                detectedPhrase: topic
            };
        }
    }

    // Additional pattern matching for diagnosis-like language
    const diagnosisPatterns = [
        /do you think i have/i,
        /what disease/i,
        /can you diagnos/i,
        /what should i take/i,
        /should i take/i,
        /\$\d+/  // Price patterns like $500
    ];

    for (const pattern of diagnosisPatterns) {
        if (pattern.test(input)) {
            return {
                safe: false,
                reason: 'Content contains prohibited topic pattern',
                escalationType: 'prohibited_topic',
                detectedPhrase: pattern.toString()
            };
        }
    }

    return { safe: true };
}

/**
 * Sanitize AI response by removing any prohibited content
 * Returns safe fallback if response is unsafe
 */
export function sanitizeAIResponse(response: string): string {
    const check = checkProhibitedTopics(response);

    if (!check.safe) {
        // Return safe fallback instead of potentially harmful response
        return "I can help with scheduling your appointment. A staff member will be happy to assist with your question.";
    }

    // Additional sanitization: remove dosage patterns
    let sanitized = response;

    // Remove dosage patterns like "500mg", "twice daily"
    sanitized = sanitized.replace(/\d+\s*(mg|milligram|gram|ml)/gi, '[dosage removed]');
    sanitized = sanitized.replace(/(once|twice|three times)\s*(daily|a day|per day)/gi, '[schedule removed]');

    // If we modified anything, return the safe fallback
    if (sanitized !== response) {
        return "I can help with scheduling your appointment. A staff member will be happy to assist with your question.";
    }

    return response;
}

/**
 * Get appropriate escalation TwiML based on safety check result
 */
export function getEscalationAction(safetyResult: SafetyCheckResult): 'escalate' | 'continue' {
    if (!safetyResult.safe) {
        return 'escalate';
    }
    return 'continue';
}

/**
 * Build the hardened system prompt for Gemini
 */
export function getHardenedSystemPrompt(callType: string): string {
    return `You are "Sarah", a dental appointment assistant for a dental practice.

CRITICAL SAFETY RULES (NEVER VIOLATE):
1. You CANNOT provide medical advice under any circumstances
2. You CANNOT diagnose any condition or symptom
3. You CANNOT recommend medications or treatments
4. You CANNOT promise specific treatment outcomes
5. You CANNOT discuss pricing, costs, or insurance details
6. You CANNOT discuss anything clinical - only scheduling

YOUR ONLY CAPABILITIES:
- Confirm existing appointments
- Help reschedule appointments  
- Note that a patient wants to cancel (staff will follow up)
- For recall calls: ask if patient wants to schedule a cleaning

IF PATIENT ASKS ABOUT:
- Pain, symptoms, or medical concerns → Say: "I understand. Let me connect you with our staff who can help with that. Please hold."
- Medication questions → Say: "For medication questions, please speak with our clinical team. I'll note that you need a callback."
- Cost or insurance → Say: "For billing questions, our front desk can help. I'll have someone call you about that."
- Anything clinical → Say: "That's a great question for our team. I focus on scheduling only."

CURRENT CALL TYPE: ${callType}

RESPONSE FORMAT:
You MUST respond with valid JSON only:
{
  "intent": "confirm" | "reschedule" | "cancel" | "question" | "unknown",
  "response_text": "Your brief, friendly response (under 30 words)",
  "requires_human": true | false,
  "confidence": 0-100
}

If unsure or if patient seems upset/distressed, set requires_human: true.`;
}
