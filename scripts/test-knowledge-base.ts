import { knowledgeService } from '../services/ai-calling/src/services/knowledge-service';
import { supabase } from '../services/ai-calling/src/lib/supabase';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env vars from services/ai-calling/.env
dotenv.config({ path: path.resolve(__dirname, '../services/ai-calling/.env') });

async function testKnowledgeBase() {
    console.log('🤖 Testing Knowledge Base (RAG)...');

    // 1. Get a clinic ID (first one)
    const { data: clinics, error } = await supabase.from('clinics').select('id').limit(1);
    if (error || !clinics || clinics.length === 0) {
        console.error('❌ Failed to get clinic:', error);
        return;
    }
    const clinicId = clinics[0].id;
    console.log(`✅ Using Clinic ID: ${clinicId}`);

    // 2. Add a document
    const testContent = "Our clinic accepts Delta Dental, MetLife, and Cigna. We do NOT accept Medicaid. Root canals start at $800.";
    console.log(`\n📝 Adding document: "${testContent}"`);

    try {
        await knowledgeService.addDocument(clinicId, testContent, { source: 'test-script' });
        console.log('✅ Document added successfully');
    } catch (err) {
        console.error('❌ Failed to add document:', err);
        return;
    }

    // 3. Search
    const query = "Do you take Medicaid and how much is a root canal?";
    console.log(`\nSYEAR: Searching for: "${query}"`);

    const results = await knowledgeService.search(clinicId, query);

    if (results.length > 0) {
        console.log(`✅ Found ${results.length} results:`);
        results.forEach((r, i) => {
            console.log(`   ${i + 1}. [${Math.round((r.similarity || 0) * 100)}%] ${r.content}`);
        });
    } else {
        console.error('❌ No results found. Vector search might not be working.');
    }
}

testKnowledgeBase().catch(console.error);
