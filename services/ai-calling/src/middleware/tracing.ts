import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { traceStorage } from '../lib/logging/context';
import { logger } from '../lib/logging/structured-logger';


export function tracingMiddleware(req: Request, _res: Response, next: NextFunction) {
    // Use existing X-Correlation-ID if provided, otherwise generate new
    const requestId =
        (req.headers['x-correlation-id'] as string) ||
        (req.headers['x-request-id'] as string) ||
        crypto.randomUUID();

    // Also try to get clinicId from req if auth middleware already ran (which it might not have yet)
    const clinicId = (req as any).clinicId;

    traceStorage.run({ requestId, clinicId }, () => {
        logger.info('Tracing initialized', { path: req.path });
        next();
    });


}

