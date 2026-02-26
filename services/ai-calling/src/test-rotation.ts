import { geminiRoundRobin } from './lib/gemini-rotation';

// Mock the environment variable
process.env.GEMINI_API_KEY = 'key-A,key-B, key-C, ,key-D ';

// Re-initialize to pick up the mock env
(geminiRoundRobin as any).initializeKeys();

console.log('Total keys loaded:', geminiRoundRobin.getKeyCount());

for (let i = 0; i < 6; i++) {
    console.log(`Call ${i + 1}: Using key -> ${geminiRoundRobin.getNextKey()}`);
}
