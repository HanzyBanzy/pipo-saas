import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '@pipo/db';
import { requireAuth } from '../../middleware/auth.js';
import { requireTenant, requireRole } from '../../middleware/tenant.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { auditLog } from '../../middleware/audit.js';
import { logger } from '../../config/logger.js';
import { syncKbItem, deleteKbFile } from '../../lib/kb-sync.js';

export const knowledgeRouter: RouterType = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const propertyParamsSchema = z.object({
  propertyId: z.string().min(1),
});

const itemParamsSchema = z.object({
  propertyId: z.string().min(1),
  itemId: z.string().min(1),
});

const listQuerySchema = z.object({
  category: z
    .enum([
      'CHECK_IN',
      'CHECK_OUT',
      'HOUSE_RULES',
      'WIFI',
      'PARKING',
      'AMENITIES',
      'LOCAL_AREA',
      'EMERGENCY',
      'FAQ',
      'CUSTOM',
    ])
    .optional(),
  accessLevel: z
    .enum(['PUBLIC', 'AI_READABLE', 'STAFF_ONLY', 'ENCRYPTED'])
    .optional(),
  isPublished: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

const createItemSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1).max(50000),
  category: z.enum([
    'CHECK_IN',
    'CHECK_OUT',
    'HOUSE_RULES',
    'WIFI',
    'PARKING',
    'AMENITIES',
    'LOCAL_AREA',
    'EMERGENCY',
    'FAQ',
    'CUSTOM',
  ]),
  accessLevel: z
    .enum(['PUBLIC', 'AI_READABLE', 'STAFF_ONLY', 'ENCRYPTED'])
    .default('AI_READABLE'),
  language: z.string().length(2).default('en'),
  sortOrder: z.number().int().default(0),
});

const updateItemSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.string().min(1).max(50000).optional(),
  category: z
    .enum([
      'CHECK_IN',
      'CHECK_OUT',
      'HOUSE_RULES',
      'WIFI',
      'PARKING',
      'AMENITIES',
      'LOCAL_AREA',
      'EMERGENCY',
      'FAQ',
      'CUSTOM',
    ])
    .optional(),
  accessLevel: z
    .enum(['PUBLIC', 'AI_READABLE', 'STAFF_ONLY', 'ENCRYPTED'])
    .optional(),
  language: z.string().length(2).optional(),
  sortOrder: z.number().int().optional(),
});

const rollbackSchema = z.object({
  version: z.number().int().min(1),
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

async function getPropertySlug(propertyId: string): Promise<string> {
  const p = await prisma.property.findUnique({ where: { id: propertyId }, select: { slug: true } });
  return p?.slug ?? propertyId;
}

// ---------------------------------------------------------------------------
// GET /properties/:propertyId/knowledge
// ---------------------------------------------------------------------------

knowledgeRouter.get(
  '/properties/:propertyId/knowledge',
  requireAuth,
  validateParams(propertyParamsSchema),
  requireTenant,
  validateQuery(listQuerySchema),
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const { propertyId } = req.params as { propertyId: string };
    const query = req.query as z.infer<typeof listQuerySchema>;

    try {
      const hasAccess = await verifyPropertyAccess(propertyId, organizationId);
      if (!hasAccess) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const items = await prisma.knowledgeItem.findMany({
        where: {
          propertyId,
          ...(query.category !== undefined && { category: query.category }),
          ...(query.accessLevel !== undefined && {
            accessLevel: query.accessLevel,
          }),
          ...(query.isPublished !== undefined && {
            isPublished: query.isPublished,
          }),
        },
        select: {
          id: true,
          title: true,
          content: true,
          category: true,
          accessLevel: true,
          isPublished: true,
          publishedAt: true,
          language: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { versions: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { category: 'asc' }, { createdAt: 'asc' }],
      });

      res.json({ items });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to list knowledge items');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /properties/:propertyId/knowledge
// ---------------------------------------------------------------------------

knowledgeRouter.post(
  '/properties/:propertyId/knowledge',
  requireAuth,
  validateParams(propertyParamsSchema),
  requireTenant,
  requireRole('OWNER', 'ADMIN', 'MEMBER'),
  validateBody(createItemSchema),
  auditLog({
    action: 'knowledge.create',
    resourceType: 'knowledgeItem',
  }),
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const { propertyId } = req.params as { propertyId: string };
    const data = req.body as z.infer<typeof createItemSchema>;

    try {
      const hasAccess = await verifyPropertyAccess(propertyId, organizationId);
      if (!hasAccess) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const item = await prisma.knowledgeItem.create({
        data: {
          propertyId,
          title: data.title,
          content: data.content,
          category: data.category,
          accessLevel: data.accessLevel,
          language: data.language,
          sortOrder: data.sortOrder,
        },
      });

      const slug = await getPropertySlug(propertyId);
      syncKbItem(slug, item);

      res.status(201).json({ item });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to create knowledge item');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /properties/:propertyId/knowledge/:itemId
// ---------------------------------------------------------------------------

knowledgeRouter.get(
  '/properties/:propertyId/knowledge/:itemId',
  requireAuth,
  validateParams(itemParamsSchema),
  requireTenant,
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const { propertyId, itemId } = req.params as {
      propertyId: string;
      itemId: string;
    };

    try {
      const hasAccess = await verifyPropertyAccess(propertyId, organizationId);
      if (!hasAccess) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const item = await prisma.knowledgeItem.findFirst({
        where: { id: itemId, propertyId },
        include: {
          versions: {
            orderBy: { version: 'desc' },
            select: {
              id: true,
              version: true,
              title: true,
              content: true,
              savedById: true,
              createdAt: true,
            },
          },
        },
      });

      if (!item) {
        res.status(404).json({ error: 'Knowledge item not found' });
        return;
      }

      res.json({ item });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to get knowledge item');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /properties/:propertyId/knowledge/:itemId
// ---------------------------------------------------------------------------

knowledgeRouter.patch(
  '/properties/:propertyId/knowledge/:itemId',
  requireAuth,
  validateParams(itemParamsSchema),
  requireTenant,
  requireRole('OWNER', 'ADMIN', 'MEMBER'),
  validateBody(updateItemSchema),
  auditLog({
    action: 'knowledge.update',
    resourceType: 'knowledgeItem',
    getResourceId: (req) => req.params['itemId'],
  }),
  async (req, res) => {
    const { organizationId, userId } = req.tenantScope!;
    const { propertyId, itemId } = req.params as {
      propertyId: string;
      itemId: string;
    };
    const updates = req.body as z.infer<typeof updateItemSchema>;

    try {
      const hasAccess = await verifyPropertyAccess(propertyId, organizationId);
      if (!hasAccess) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const existing = await prisma.knowledgeItem.findFirst({
        where: { id: itemId, propertyId },
        include: { _count: { select: { versions: true } } },
      });

      if (!existing) {
        res.status(404).json({ error: 'Knowledge item not found' });
        return;
      }

      // Save version snapshot before updating
      const nextVersion = existing._count.versions + 1;
      await prisma.knowledgeVersion.create({
        data: {
          knowledgeItemId: itemId,
          version: nextVersion,
          title: existing.title,
          content: existing.content,
          savedById: userId,
        },
      });

      const item = await prisma.knowledgeItem.update({
        where: { id: itemId },
        data: {
          ...updates,
          ...(updates.content !== undefined && {
            embedding: undefined,
            embeddedAt: null,
          }),
        },
      });

      const slug = await getPropertySlug(propertyId);
      syncKbItem(slug, item);

      res.json({ item });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to update knowledge item');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /properties/:propertyId/knowledge/:itemId/publish
// ---------------------------------------------------------------------------

knowledgeRouter.post(
  '/properties/:propertyId/knowledge/:itemId/publish',
  requireAuth,
  validateParams(itemParamsSchema),
  requireTenant,
  requireRole('OWNER', 'ADMIN'),
  auditLog({
    action: 'knowledge.publish',
    resourceType: 'knowledgeItem',
    getResourceId: (req) => req.params['itemId'],
  }),
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const { propertyId, itemId } = req.params as {
      propertyId: string;
      itemId: string;
    };

    try {
      const hasAccess = await verifyPropertyAccess(propertyId, organizationId);
      if (!hasAccess) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const existing = await prisma.knowledgeItem.findFirst({
        where: { id: itemId, propertyId },
        select: { id: true },
      });

      if (!existing) {
        res.status(404).json({ error: 'Knowledge item not found' });
        return;
      }

      const item = await prisma.knowledgeItem.update({
        where: { id: itemId },
        data: { isPublished: true, publishedAt: new Date() },
      });

      const slug = await getPropertySlug(propertyId);
      syncKbItem(slug, item);

      res.json({ item });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to publish knowledge item');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /properties/:propertyId/knowledge/:itemId/rollback
// ---------------------------------------------------------------------------

knowledgeRouter.post(
  '/properties/:propertyId/knowledge/:itemId/rollback',
  requireAuth,
  validateParams(itemParamsSchema),
  requireTenant,
  requireRole('OWNER', 'ADMIN'),
  validateBody(rollbackSchema),
  auditLog({
    action: 'knowledge.rollback',
    resourceType: 'knowledgeItem',
    getResourceId: (req) => req.params['itemId'],
  }),
  async (req, res) => {
    const { organizationId, userId } = req.tenantScope!;
    const { propertyId, itemId } = req.params as {
      propertyId: string;
      itemId: string;
    };
    const { version } = req.body as z.infer<typeof rollbackSchema>;

    try {
      const hasAccess = await verifyPropertyAccess(propertyId, organizationId);
      if (!hasAccess) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const targetVersion = await prisma.knowledgeVersion.findUnique({
        where: { knowledgeItemId_version: { knowledgeItemId: itemId, version } },
      });

      if (!targetVersion) {
        res.status(404).json({ error: 'Version not found' });
        return;
      }

      // Save current state as a new version before rolling back
      const current = await prisma.knowledgeItem.findFirst({
        where: { id: itemId, propertyId },
        include: { _count: { select: { versions: true } } },
      });

      if (!current) {
        res.status(404).json({ error: 'Knowledge item not found' });
        return;
      }

      const nextVersion = current._count.versions + 1;
      await prisma.knowledgeVersion.create({
        data: {
          knowledgeItemId: itemId,
          version: nextVersion,
          title: current.title,
          content: current.content,
          savedById: userId,
        },
      });

      const item = await prisma.knowledgeItem.update({
        where: { id: itemId },
        data: {
          title: targetVersion.title,
          content: targetVersion.content,
          isPublished: false, // unpublish on rollback — require explicit re-publish
          publishedAt: null,
          embeddedAt: null,
        },
      });

      res.json({ item, rolledBackToVersion: version });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to rollback knowledge item');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /properties/:propertyId/knowledge/:itemId
// ---------------------------------------------------------------------------

knowledgeRouter.delete(
  '/properties/:propertyId/knowledge/:itemId',
  requireAuth,
  validateParams(itemParamsSchema),
  requireTenant,
  requireRole('OWNER', 'ADMIN'),
  auditLog({
    action: 'knowledge.delete',
    resourceType: 'knowledgeItem',
    getResourceId: (req) => req.params['itemId'],
  }),
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const { propertyId, itemId } = req.params as {
      propertyId: string;
      itemId: string;
    };

    try {
      const hasAccess = await verifyPropertyAccess(propertyId, organizationId);
      if (!hasAccess) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const existing = await prisma.knowledgeItem.findFirst({
        where: { id: itemId, propertyId },
        select: { id: true },
      });

      if (!existing) {
        res.status(404).json({ error: 'Knowledge item not found' });
        return;
      }

      const toDelete = await prisma.knowledgeItem.findUnique({
        where: { id: itemId },
        select: { title: true, category: true },
      });

      await prisma.knowledgeItem.delete({ where: { id: itemId } });

      if (toDelete) {
        const slug = await getPropertySlug(propertyId);
        deleteKbFile(slug, toDelete.category, toDelete.title);
      }

      res.status(204).send();
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to delete knowledge item');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);
