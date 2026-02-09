import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import { logger } from "./logger";
import {
    getHardenedSystemPrompt,
    sanitizeAIResponse,
    checkProhibitedTopics
} from "./safety-boundaries";

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
    logger.error("Missing GEMINI_API_KEY");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

export interface AnalysisResult {
    intent: "confirm" | "reschedule" | "cancel" | "book_appointment" | "question" | "not_interested" | "unknown";
    response_text: string;
    confidence: number;
    requires_human: boolean;
}

/**
 * Analyze patient intent with safety-hardened prompt.
 * Returns sanitized response with requires_human flag.
 */
export async function analyzeIntent(
    callContext: string,
    userTranscript: string,
    callType: string = 'confirmation'
): Promise<AnalysisResult> {
    const systemPrompt = getHardenedSystemPrompt(callType);

    const userPrompt = `
APPOINTMENT CONTEXT:
${callContext}

PATIENT SAID: "${userTranscript}"

Analyze and respond with JSON only.`;

    try {
        const result = await model.generateContent(systemPrompt + '\n\n' + userPrompt);
        const response = await result.response;
        const text = response.text();

        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in Gemini response');
        }

        const jsonStr = jsonMatch[0];
        const parsed = JSON.parse(jsonStr);

        // Extract values with safe defaults
        const rawResponseText = parsed.response_text || "Let me connect you with our team.";
        const intent = parsed.intent || 'unknown';
        const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
        let requiresHuman = parsed.requires_human === true;

        // SAFETY CHECK: Verify response doesn't contain prohibited topics
        const safetyCheck = checkProhibitedTopics(rawResponseText);
        if (!safetyCheck.safe) {
            logger.warn("AI response contained prohibited topic, sanitizing", {
                original: rawResponseText,
                detectedPhrase: safetyCheck.detectedPhrase
            });
            requiresHuman = true;
        }

        // Sanitize the response text
        const sanitizedResponse = sanitizeAIResponse(rawResponseText);

        // Force human escalation on low confidence
        if (confidence < 50) {
            requiresHuman = true;
        }

        // Force human escalation if intent is question (patient asking clinical questions)
        if (intent === 'question') {
            requiresHuman = true;
        }

        return {
            intent,
            response_text: sanitizedResponse,
            confidence,
            requires_human: requiresHuman
        };

    } catch (error) {
        logger.error("Gemini analysis failed", { error: (error as any).message });

        // Safe fallback - always offer human escalation on failure
        return {
            intent: "unknown",
            response_text: "I apologize, let me connect you with our team who can better assist you.",
            confidence: 0,
            requires_human: true
        };
    }
}

