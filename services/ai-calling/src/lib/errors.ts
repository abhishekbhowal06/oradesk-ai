import { ErrorContext } from '../types';

export enum ErrorCategory {
    AI_HALLUCINATION = 'AI_HALLUCINATION',
    TRANSCRIPTION_FAIL = 'TRANSCRIPTION_FAIL',
    LATENCY_TIMEOUT = 'LATENCY_TIMEOUT',
    PMS_LOCK_FAIL = 'PMS_LOCK_FAIL',
    BILLING_EXCEEDED = 'BILLING_EXCEEDED',
    TWILIO_ERROR = 'TWILIO_ERROR',
    DATABASE_ERROR = 'DATABASE_ERROR',
    UNKNOWN = 'UNKNOWN',
}

export class AppError extends Error {
    public readonly category: ErrorCategory;
    public readonly retryable: boolean;
    public readonly context?: ErrorContext;

    constructor(message: string, category: ErrorCategory, retryable = false, context?: ErrorContext) {
        super(message);
        this.name = 'AppError';
        this.category = category;
        this.retryable = retryable;
        this.context = context;
    }
}

export class AIServiceError extends AppError {
    constructor(message: string, category: ErrorCategory = ErrorCategory.AI_HALLUCINATION, context?: ErrorContext) {
        super(message, category, true, context);
        this.name = 'AIServiceError';
    }
}

export class PMSError extends AppError {
    constructor(message: string, context?: ErrorContext) {
        super(message, ErrorCategory.PMS_LOCK_FAIL, false, context);
        this.name = 'PMSError';
    }
}
