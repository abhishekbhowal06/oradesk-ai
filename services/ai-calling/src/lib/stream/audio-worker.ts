import { parentPort } from 'worker_threads';
import { Buffer } from 'buffer';

// This worker processes raw base64 audio strings,
// converting them to binary Buffers off the main thread.

parentPort?.on('message', (message: { id: string; base64Payload: string }) => {
    try {
        if (!message.base64Payload) {
            parentPort?.postMessage({ id: message.id, error: 'Empty payload' });
            return;
        }

        // CPU-bound base64 decoding
        const audioData = Buffer.from(message.base64Payload, 'base64');

        // Return ownership of the buffer to the main thread efficiently
        parentPort?.postMessage({ id: message.id, audioData }, [audioData.buffer]);
    } catch (error: any) {
        parentPort?.postMessage({ id: message.id, error: error.message });
    }
});
