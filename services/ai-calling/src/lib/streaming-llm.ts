import { logger } from './logger';
import { analyzeIntent } from './gemini';

export class StreamingLLM {
    private context: string = "";
    private buffer: string = "";

    constructor(initialContext: string) {
        this.context = initialContext;
    }

    // Called when STT provider yields a final sentence
    public async handleUserTranscript(transcript: string): Promise<string | null> {
        logger.info(`Streaming LLM received: ${transcript}`);

        // Append to conversation history
        this.context += `\nPatient: "${transcript}"`;

        // Check for interruption or end of turn
        // For scaffold, we reuse the REST analyzer for now, 
        // but in real-time we would likely keep an open session.
        const result = await analyzeIntent(this.context, transcript);

        if (result.response_text) {
            this.context += `\nAI: "${result.response_text}"`;
            return result.response_text;
        }

        return null;
    }
}
