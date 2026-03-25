import { createHash } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '@pipo/db';
import { logger } from '../config/logger.js';

interface AuditOptions {
  action: string;
  resourceType?: string;
  getResourceId?: (req: Request) => string | string[] | undefined;
}

export function auditLog(opts: AuditOptions) {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    // Fire-and-forget audit log — don't block the request
    setImmediate(() => {
      void (async () => {
        try {
          await prisma.auditLog.create({
            data: {
              organizationId: req.tenantScope?.organizationId,
              actorId: req.tenantScope?.userId,
              actorType: req.tenantScope ? 'user' : 'guest',
              action: opts.action,
              resourceType: opts.resourceType,
              resourceId: opts.getResourceId?.(req)?.toString(),
              ipAddress: req.ip ? hashIp(req.ip) : undefined,
              userAgent: req.headers['user-agent']?.slice(0, 200),
            },
          });
        } catch (err: unknown) {
          logger.error({ err }, 'Failed to write audit log');
        }
      })();
    });
    next();
  };
}

// Hash IP for privacy compliance (GDPR)
function hashIp(ip: string): string {
  const salt = process.env['IP_HASH_SALT'] ?? 'pipo';
  return createHash('sha256')
    .update(ip + salt)
    .digest('hex')
    .slice(0, 16);
}
