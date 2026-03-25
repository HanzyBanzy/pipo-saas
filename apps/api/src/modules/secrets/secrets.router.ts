import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '@pipo/db';
import { requireAuth } from '../../middleware/auth.js';
import { requireTenant, requireRole } from '../../middleware/tenant.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { auditLog } from '../../middleware/audit.js';
import { encryptSecret } from '../../security/vault.js';
import { logger } from '../../config/logger.js';

export const secretsRouter: RouterType = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const propertyParamsSchema = z.object({
  propertyId: z.string().min(1),
});

const secretKeyParamsSchema = z.object({
  propertyId: z.string().min(1),
  key: z.string().min(1),
});

const upsertSecretSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(
      /^[a-z0-9_]+$/,
      'Key must be lowercase alphanumeric with underscores',
    ),
  value: z.string().min(1).max(2000),
  guestHint: z.string().max(500).optional(),
});

// ---------------------------------------------------------------------------
// Helper: verify property belongs to org
// ---------------------------------------------------------------------------

async function verifyPropertyAccess(
  propertyId: string,
  organizationId: string,
): Promise<boolean> {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, organizationId },
    select: { id: true },
  });
  return property !== null;
}

// ---------------------------------------------------------------------------
// GET /properties/:propertyId/secrets
// Returns keys and hints ONLY — never the encrypted values
// ---------------------------------------------------------------------------

secretsRouter.get(
  '/properties/:propertyId/secrets',
  requireAuth,
  validateParams(propertyParamsSchema),
  requireTenant,
  requireRole('OWNER', 'ADMIN'),
  auditLog({
    action: 'secret.list',
    resourceType: 'secret',
    getResourceId: (req) => req.params['propertyId'],
  }),
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const { propertyId } = req.params as { propertyId: string };

    try {
      const hasAccess = await verifyPropertyAccess(propertyId, organizationId);
      if (!hasAccess) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const secrets = await prisma.secretItem.findMany({
        where: { propertyId },
        select: {
          id: true,
          key: true,
          guestHint: true,
          createdAt: true,
          updatedAt: true,
          // value, iv, authTag are intentionally excluded
        },
        orderBy: { key: 'asc' },
      });

      res.json({ secrets });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to list secrets');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /properties/:propertyId/secrets
// Create or update (upsert) a secret — encrypts on receipt, never returns value
// ---------------------------------------------------------------------------

secretsRouter.post(
  '/properties/:propertyId/secrets',
  requireAuth,
  validateParams(propertyParamsSchema),
  requireTenant,
  requireRole('OWNER', 'ADMIN'),
  validateBody(upsertSecretSchema),
  auditLog({
    action: 'secret.upsert',
    resourceType: 'secret',
    getResourceId: (req) => req.params['propertyId'],
  }),
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const { propertyId } = req.params as { propertyId: string };
    const { key, value, guestHint } = req.body as z.infer<
      typeof upsertSecretSchema
    >;

    try {
      const hasAccess = await verifyPropertyAccess(propertyId, organizationId);
      if (!hasAccess) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      // Encrypt the secret value
      const encrypted = encryptSecret(value);

      const secret = await prisma.secretItem.upsert({
        where: { propertyId_key: { propertyId, key } },
        create: {
          propertyId,
          key,
          value: encrypted.value,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          guestHint: guestHint ?? null,
        },
        update: {
          value: encrypted.value,
          iv: encrypted.iv,
          authTag: encrypted.authTag,
          ...(guestHint !== undefined && { guestHint }),
        },
        select: {
          id: true,
          key: true,
          guestHint: true,
          createdAt: true,
          updatedAt: true,
          // value, iv, authTag excluded
        },
      });

      logger.info({ propertyId, key }, 'Secret upserted');
      res.status(201).json({ secret });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to upsert secret');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /properties/:propertyId/secrets/:key
// ---------------------------------------------------------------------------

secretsRouter.delete(
  '/properties/:propertyId/secrets/:key',
  requireAuth,
  validateParams(secretKeyParamsSchema),
  requireTenant,
  requireRole('OWNER', 'ADMIN'),
  auditLog({
    action: 'secret.delete',
    resourceType: 'secret',
    getResourceId: (req) => `${req.params['propertyId']}:${req.params['key']}`,
  }),
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const { propertyId, key } = req.params as {
      propertyId: string;
      key: string;
    };

    try {
      const hasAccess = await verifyPropertyAccess(propertyId, organizationId);
      if (!hasAccess) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const existing = await prisma.secretItem.findUnique({
        where: { propertyId_key: { propertyId, key } },
        select: { id: true },
      });

      if (!existing) {
        res.status(404).json({ error: 'Secret not found' });
        return;
      }

      await prisma.secretItem.delete({
        where: { propertyId_key: { propertyId, key } },
      });

      logger.info({ propertyId, key }, 'Secret deleted');
      res.status(204).send();
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to delete secret');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);
