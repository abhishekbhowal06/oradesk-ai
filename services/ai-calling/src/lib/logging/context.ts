import { AsyncLocalStorage } from 'async_hooks';

export interface TraceContext {
    callId?: string;
    clinicId?: string;
    requestId?: string;
}

export const traceStorage = new AsyncLocalStorage<TraceContext>();

/**
 * Execute a function within a specific trace context
 */
export function runWithContext<T>(context: TraceContext, fn: () => T): T {
    return traceStorage.run(context, fn);
}

/**
 * Get current trace context
 */
export function getContext(): TraceContext | undefined {
    return traceStorage.getStore();
}
