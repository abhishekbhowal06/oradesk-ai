import { Worker } from 'worker_threads';
import path from 'path';
import { logger } from '../logging/structured-logger';

// Use compiled JS path in production, TS path in dev (handled by ts-node/register)
const WORKER_PATH = path.join(__dirname, 'audio-worker.ts');
const POOL_SIZE = Math.max(2, Math.floor(require('os').cpus().length / 2));

interface JobResult {
    id: string;
    audioData?: Buffer;
    error?: string;
}

export class AudioWorkerPool {
    private workers: Worker[] = [];
    private nextWorkerIndex = 0;
    private callbacks = new Map<string, { resolve: (data: Buffer) => void, reject: (err: Error) => void }>();
    private jobCounter = 0;

    constructor() {
        this.initializePool();
    }

    private initializePool() {
        logger.info(`Initializing AudioWorkerPool with ${POOL_SIZE} threads`);
        for (let i = 0; i < POOL_SIZE; i++) {
            this.createWorker(i);
        }
    }

    private createWorker(index: number) {
        const worker = new Worker(WORKER_PATH, {
            // Needed if running directly via ts-node, in prod node will load the compiled .js
            execArgv: process.env.NODE_ENV !== 'production' ? ['-r', 'ts-node/register'] : []
        });

        worker.on('message', (result: JobResult) => {
            const ob = this.callbacks.get(result.id);
            if (!ob) return;

            this.callbacks.delete(result.id);
            if (result.error) {
                ob.reject(new Error(result.error));
            } else if (result.audioData) {
                ob.resolve(result.audioData);
            }
        });

        worker.on('error', (err) => {
            logger.error(`AudioWorker[${index}] error`, { error: err.message });
        });

        worker.on('exit', (code) => {
            if (code !== 0) {
                logger.error(`AudioWorker[${index}] exited with code ${code}, replacing...`);
                this.workers[index] = this.createWorkerInstance(); // Replace dead worker
            }
        });

        this.workers.push(worker);
    }

    private createWorkerInstance(): Worker {
        const worker = new Worker(WORKER_PATH, {
            execArgv: process.env.NODE_ENV !== 'production' ? ['-r', 'ts-node/register'] : []
        });

        worker.on('message', (result: JobResult) => {
            const ob = this.callbacks.get(result.id);
            if (ob) {
                this.callbacks.delete(result.id);
                if (result.error) ob.reject(new Error(result.error));
                else if (result.audioData) ob.resolve(result.audioData);
            }
        });

        return worker;
    }

    public async decodeBase64(base64Payload: string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            if (this.workers.length === 0) {
                // Fallback if pool is broken
                try {
                    resolve(Buffer.from(base64Payload, 'base64'));
                } catch (e) {
                    reject(e);
                }
                return;
            }

            const id = `job_${this.jobCounter++}`;
            this.callbacks.set(id, { resolve, reject });

            // Round-robin selection
            const worker = this.workers[this.nextWorkerIndex];
            this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;

            worker.postMessage({ id, base64Payload });
        });
    }

    public cleanup() {
        logger.info('Shutting down AudioWorkerPool');
        for (const worker of this.workers) {
            worker.terminate();
        }
        this.workers = [];
        this.callbacks.clear();
    }
}

// Global Singleton Instance
export const globalAudioWorkerPool = new AudioWorkerPool();
