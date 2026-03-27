import { clerkMiddleware, getAuth } from '@clerk/express';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from '../config/logger.js';

const DEV_TOKEN = 'dev-token';
const isDev = process.env['NODE_ENV'] !== 'production';

// Apply to all routes — populates req.auth
// In dev mode without a Clerk publishable key, skip Clerk entirely so the
// dev-token bypass in requireAuth / requireTenant can function.
const hasClerkKey = Boolean(process.env['CLERK_PUBLISHABLE_KEY']);

export const clerkAuth: RequestHandler = hasClerkKey
  ? (clerkMiddleware() as RequestHandler)
  : (_req, _res, next) => next();

// Use on protected routes — rejects if not authenticated
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Dev bypass — allows dashboard to work without Clerk JWT
  if (isDev) {
    const bearer = (req.headers['authorization'] ?? '').replace('Bearer ', '');
    if (bearer === DEV_TOKEN) {
      next();
      return;
    }
  }

  const auth = getAuth(req);
  if (!auth.userId) {
    logger.warn({ path: req.path }, 'Unauthenticated request rejected');
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
