import { supabase } from '../lib/supabase';
import { logger } from '../lib/logging/structured-logger';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { geminiRoundRobin } from '../lib/gemini-rotation';

function getEmbeddingModel() {
    const key = geminiRoundRobin.getNextKey();
    if (!key) throw new Error('No valid Gemini API keys found in rotation pool');
    const genAI = new GoogleGenerativeAI(key);
    return genAI.getGenerativeModel({ model: 'text-embedding-004' });
}

interface Document {
    id: string;
    clinicId: string;
    content: string;
    metadata?: Record<string, any>;
    similarity?: number;
}

export class KnowledgeService {
    private model: any;

    constructor() {
        // Model is initialized dynamically per request
    }

    /**
     * Generate embedding for text
     */
    async generateEmbedding(text: string): Promise<number[]> {
        try {
            this.model = getEmbeddingModel();
            const result = await this.model.embedContent(text);
            return result.embedding.values;
        } catch (error) {
            logger.error('Failed to generate embedding', { error });
            throw error;
        }
    }

    /**
     * Add a document to the knowledge base
     */
    async addDocument(clinicId: string, content: string, metadata: Record<string, any> = {}) {
        try {
            const embedding = await this.generateEmbedding(content);

            const { data, error } = await supabase
                .from('documents')
                .insert({
                    clinic_id: clinicId,
                    content,
                    embedding,
                    metadata,
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            logger.error('Failed to add document', { error, clinicId });
            throw error;
        }
    }

    /**
     * Search for relevant documents
     */
    async search(clinicId: string, query: string, limit: number = 3): Promise<Document[]> {
        try {
            const queryEmbedding = await this.generateEmbedding(query);

            const { data, error } = await supabase.rpc('match_documents', {
                query_embedding: queryEmbedding,
                match_threshold: 0.5, // Adjust based on precision needs
                match_count: limit,
                filter_clinic_id: clinicId,
            });

            if (error) throw error;

            return (data || []).map((doc: any) => ({
                id: doc.id,
                clinicId,
                content: doc.content,
                metadata: doc.metadata,
                similarity: doc.similarity,
            }));
        } catch (error) {
            logger.error('Knowledge search failed', { error, clinicId, query });
            return [];
        }
    }
}

export const knowledgeService = new KnowledgeService();
