import winston from 'winston';
import { traceStorage } from './context';

const { combine, timestamp, json, printf, colorize } = winston.format;

// Format to inject trace context (Correlation IDs)
const injectTrace = winston.format((info) => {
  const context = traceStorage.getStore();
  if (context) {
    if (context.callId) info.callId = context.callId;
    if (context.clinicId) info.clinicId = context.clinicId;
    if (context.requestId) info.requestId = context.requestId;
  }

  // Handle AppError properties
  if (info instanceof Error) {
    const err = info as any;
    if (err.category) info.category = err.category;
    if (err.retryable !== undefined) info.retryable = err.retryable;
  }

  return info;
});


// Custom format for dev readability
const devFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` | ${JSON.stringify(metadata)}`;
  }
  return msg;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    injectTrace(),
    timestamp(),
    json(), // Production default: structured JSON
  ),
  defaultMeta: { service: 'ai-calling-service' },
  transports: [
    new winston.transports.Console({
      format:
        process.env.NODE_ENV === 'development'
          ? combine(injectTrace(), colorize(), timestamp(), devFormat)
          : combine(injectTrace(), timestamp(), json()),
    }),
  ],
});


// Helper for correlation IDs (stub for now, can perform AsyncLocalStorage later)
export const withContext = (context: Record<string, any>) => {
  return logger.child(context);
};
