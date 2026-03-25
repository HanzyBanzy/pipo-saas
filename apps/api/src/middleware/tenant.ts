import type { Request, Response, NextFunction } from 'express';
import { getAuth } from '@clerk/express';
import { prisma } from '@pipo/db';
import type { TenantScope } from '@pipo/types';
import { logger } from '../config/logger.js';

/**
 * Tenant middleware — resolves org membership and attaches tenantScope to req.
 *
 * Requires:
 *  - Clerk auth (run after requireAuth)
 *  - x-organization-id header
 *
 * On success: sets req.tenantScope with { organizationId, userId, role }
 * On failure: responds with 401 or 403
 */
const DEV_TOKEN = 'dev-token';
const isDev = process.env['NODE_ENV'] !== 'production';

export async function requireTenant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  // Dev bypass — use first org in DB without Clerk validation
  if (isDev) {
    const bearer = (req.headers['authorization'] ?? '').replace('Bearer ', '');
    if (bearer === DEV_TOKEN) {
      const orgHeader = req.headers['x-organization-id'];
      const org = await prisma.organization.findFirst({ select: { id: true } });
      if (!org) {
        res.status(500).json({ error: 'No organization in database. Run: pnpm db:seed' });
        return;
      }
      const user = await prisma.user.findFirst({ select: { id: true } });
      if (!user) {
        res.status(500).json({ error: 'No user in database. Run: pnpm db:seed' });
        return;
      }
      req.tenantScope = {
        organizationId: org.id,
        userId: user.id,
        role: 'OWNER',
      };
      next();
      return;
    }
  }

  const auth = getAuth(req);

  if (!auth.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const organizationId = req.headers['x-organization-id'];

  if (!organizationId || typeof organizationId !== 'string') {
    res.status(400).json({ error: 'Missing x-organization-id header' });
    return;
  }

  // Look up the Pipo user by Clerk ID
  const user = await prisma.user.findUnique({
    where: { clerkId: auth.userId },
    select: { id: true },
  });

  if (!user) {
    logger.warn({ clerkId: auth.userId }, 'No Pipo user found for Clerk ID');
    res.status(401).json({ error: 'User not found' });
    return;
  }

  // Verify membership
  const membership = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: user.id,
      },
    },
    select: { role: true },
  });

  if (!membership) {
    logger.warn(
      { userId: user.id, organizationId },
      'Access denied — not a member of organization',
    );
    res
      .status(403)
      .json({ error: 'Forbidden: not a member of this organization' });
    return;
  }

  const scope: TenantScope = {
    organizationId,
    userId: user.id,
    role: membership.role,
  };

  req.tenantScope = scope;

  logger.debug(
    { userId: user.id, organizationId, role: membership.role },
    'Tenant scope resolved',
  );

  next();
}

/**
 * Guard that enforces a minimum role within the tenant.
 * Must be used after requireTenant.
 */
export function requireRole(...allowedRoles: TenantScope['role'][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const scope = req.tenantScope;
    if (!scope) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!allowedRoles.includes(scope.role)) {
      res
        .status(403)
        .json({ error: 'Forbidden: insufficient permissions' });
      return;
    }
    next();
  };
}
