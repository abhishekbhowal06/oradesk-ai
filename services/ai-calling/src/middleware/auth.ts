/**
 * AUTHENTICATION MIDDLEWARE
 *
 * Verifies Supabase-issued JWTs on incoming requests.
 * Applied to all /v1/* routes EXCEPT webhooks and health checks.
 *
 * Requires SUPABASE_JWT_SECRET in environment.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin, createUserScopedClient } from '../lib/supabase';
import { logger } from '../lib/logging/structured-logger';
import { SupabaseClient } from '@supabase/supabase-js';

// ── Types ───────────────────────────────────────────────────

export interface AuthenticatedUser {
  sub: string; // Supabase user UUID
  email?: string;
  role?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}

// Extend Express Request to include authenticated user and validated clinic
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      clinicId?: string; // The validated clinic ID this user is authorized to act on
      userToken?: string; // The raw JWT for creating user-scoped clients
      supabaseUser?: SupabaseClient; // User-scoped Supabase client (respects RLS)
    }
  }
}

// ── Configuration ───────────────────────────────────────────

const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';

if (!JWT_SECRET) {
  logger.warn(
    '⚠️  SUPABASE_JWT_SECRET is not set. Auth middleware will reject ALL requests. ' +
    'Get it from: Supabase Dashboard → Settings → API → JWT Secret',
  );
}

// ── Middleware ───────────────────────────────────────────────

/**
 * Require a valid Supabase JWT in the Authorization header.
 * Rejects with 401 if missing or invalid.
 * Attaches a user-scoped Supabase client to req.supabaseUser for RLS-respecting queries.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Missing authorization header',
      hint: 'Include header: Authorization: Bearer <supabase_access_token>',
    });
    return;
  }

  const token = authHeader.substring(7); // Strip "Bearer "

  if (!JWT_SECRET) {
    logger.error('Cannot verify JWT — SUPABASE_JWT_SECRET is not configured');
    res.status(500).json({
      error: 'Server authentication is misconfigured',
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    }) as AuthenticatedUser;

    // Attach user info to request for downstream handlers
    req.user = decoded;
    req.userToken = token;

    // Create a user-scoped Supabase client that respects RLS
    req.supabaseUser = createUserScopedClient(token);

    next();
  } catch (err) {
    const message =
      err instanceof jwt.TokenExpiredError
        ? 'Token has expired'
        : err instanceof jwt.JsonWebTokenError
          ? 'Invalid token'
          : 'Authentication failed';

    logger.debug('Auth rejected', { reason: message, ip: req.ip });

    res.status(401).json({ error: message });
  }
}

/**
 * Middleware to ensure the user has access to a specific clinic.
 *
 * Logic:
 * 1. Checks req.user.sub (must run after requireAuth)
 * 2. If req.body.clinic_id is present, verifies user belongs to it.
 * 3. If req.body.clinic_id is MISSING, checks if user belongs to exactly one clinic.
 * 4. Sets req.clinicId to the validated ID.
 * 5. Rejects with 403 if no access or ambiguous context.
 * 
 * NOTE: Uses supabaseAdmin for membership lookup — this is intentional because
 * the staff_memberships table itself needs service_role to read during auth check.
 */
export const requireClinicAccess = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!req.user || !req.user.sub) {
    res.status(401).json({ error: 'User not authenticated' });
    return;
  }

  const userId = req.user.sub;
  // Check allow both body and query params
  const requestedClinicId = req.body.clinic_id || req.query.clinic_id;

  try {
    // Fetch all memberships for this user
    // JUSTIFICATION: service_role needed to read staff_memberships for authorization.
    // The membership table itself is the authorization source — can't use user-scoped here.
    const { data: memberships, error } = await supabaseAdmin
      .from('staff_memberships')
      .select('clinic_id, role')
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to fetch user memberships', { userId, error: error.message });
      res.status(500).json({ error: 'Internal authorization error' });
      return;
    }

    if (!memberships || memberships.length === 0) {
      logger.warn('Auth blocked: User has no clinic memberships', { userId });
      res.status(403).json({
        error: 'Access denied: You are not a member of any clinic.',
        code: 'NO_CLINIC_MEMBERSHIP',
      });
      return;
    }

    const allowedClinicIds = memberships.map((m) => m.clinic_id);

    // CASE 1: Client requested a specific clinic
    if (requestedClinicId) {
      if (allowedClinicIds.includes(requestedClinicId)) {
        req.clinicId = requestedClinicId as string;
        next();
        return;
      } else {
        logger.warn('Security Alert: IDOR Attempt?', {
          userId,
          requestedClinicId,
          allowed: allowedClinicIds,
        });
        res.status(403).json({
          error: 'Access denied: You do not have permission for this clinic.',
          code: 'CLINIC_ACCESS_DENIED',
        });
        return;
      }
    }

    // CASE 2: No specific clinic requested
    if (memberships.length === 1) {
      // Unambiguous - default to their only clinic
      req.clinicId = memberships[0].clinic_id;
      next();
      return;
    }

    // Ambiguous - User has multiple clinics but didn't specify one
    res.status(400).json({
      error: 'Ambiguous context: You belong to multiple clinics. Please specify "clinic_id".',
      code: 'MISSING_CLINIC_ID',
    });
  } catch (err) {
    logger.error('Unexpected error in requireClinicAccess', { error: (err as Error).message });
    res.status(500).json({ error: 'Authorization failed' });
  }
};
