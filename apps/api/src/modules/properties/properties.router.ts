import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '@pipo/db';
import { requireAuth } from '../../middleware/auth.js';
import { requireTenant, requireRole } from '../../middleware/tenant.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { auditLog } from '../../middleware/audit.js';
import { logger } from '../../config/logger.js';

export const propertiesRouter: RouterType = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createPropertySchema = z.object({
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  timezone: z.string().default('UTC'),
  defaultLanguage: z.string().length(2).default('en'),
  personalityMode: z
    .enum(['PROFESSIONAL', 'FRIENDLY', 'CONCIERGE', 'MINIMAL'])
    .default('CONCIERGE'),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});

const updatePropertySchema = z.object({
  name: z.string().min(2).max(120).optional(),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  timezone: z.string().optional(),
  defaultLanguage: z.string().length(2).optional(),
  personalityMode: z
    .enum(['PROFESSIONAL', 'FRIENDLY', 'CONCIERGE', 'MINIMAL'])
    .optional(),
  aiEnabled: z.boolean().optional(),
  webChatEnabled: z.boolean().optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  systemPromptExtra: z.string().max(2000).optional(),
});

const propertyIdSchema = z.object({
  propertyId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// GET / — list all properties for the org
// ---------------------------------------------------------------------------

propertiesRouter.get('/', requireAuth, requireTenant, async (req, res) => {
  const { organizationId } = req.tenantScope!;

  try {
    const properties = await prisma.property.findMany({
      where: { organizationId, status: { not: 'INACTIVE' } },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        timezone: true,
        defaultLanguage: true,
        personalityMode: true,
        aiEnabled: true,
        webChatEnabled: true,
        brandColor: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            conversations: true,
            knowledgeItems: { where: { isPublished: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ properties });
  } catch (err: unknown) {
    logger.error({ err }, 'Failed to list properties');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST / — create property
// ---------------------------------------------------------------------------

propertiesRouter.post(
  '/',
  requireAuth,
  requireTenant,
  requireRole('OWNER', 'ADMIN'),
  validateBody(createPropertySchema),
  auditLog({ action: 'property.create', resourceType: 'property' }),
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const data = req.body as z.infer<typeof createPropertySchema>;

    try {
      // Verify slug is unique within this org
      const existing = await prisma.property.findUnique({
        where: { organizationId_slug: { organizationId, slug: data.slug } },
        select: { id: true },
      });

      if (existing) {
        res
          .status(409)
          .json({ error: 'A property with this slug already exists' });
        return;
      }

      const property = await prisma.property.create({
        data: {
          organizationId,
          name: data.name,
          slug: data.slug,
          timezone: data.timezone,
          defaultLanguage: data.defaultLanguage,
          personalityMode: data.personalityMode,
          brandColor: data.brandColor ?? null,
        },
      });

      logger.info(
        { propertyId: property.id, organizationId },
        'Property created',
      );
      res.status(201).json({ property });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to create property');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:propertyId — get property
// ---------------------------------------------------------------------------

propertiesRouter.get(
  '/:propertyId',
  requireAuth,
  validateParams(propertyIdSchema),
  requireTenant,
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const { propertyId } = req.params as { propertyId: string };

    try {
      const property = await prisma.property.findFirst({
        where: { id: propertyId, organizationId },
      });

      if (!property) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      res.json({ property });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to get property');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /:propertyId — update property settings
// ---------------------------------------------------------------------------

propertiesRouter.patch(
  '/:propertyId',
  requireAuth,
  validateParams(propertyIdSchema),
  requireTenant,
  requireRole('OWNER', 'ADMIN'),
  validateBody(updatePropertySchema),
  auditLog({
    action: 'property.update',
    resourceType: 'property',
    getResourceId: (req) => req.params['propertyId'],
  }),
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const { propertyId } = req.params as { propertyId: string };
    const updates = req.body as z.infer<typeof updatePropertySchema>;

    try {
      // Verify the property belongs to this org
      const existing = await prisma.property.findFirst({
        where: { id: propertyId, organizationId },
        select: { id: true, slug: true },
      });

      if (!existing) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      // Check slug uniqueness if changing it
      if (updates.slug && updates.slug !== existing.slug) {
        const slugConflict = await prisma.property.findFirst({
          where: {
            organizationId,
            slug: updates.slug,
            NOT: { id: propertyId },
          },
          select: { id: true },
        });
        if (slugConflict) {
          res
            .status(409)
            .json({ error: 'A property with this slug already exists' });
          return;
        }
      }

      // Strip undefined values to satisfy Prisma's exactOptionalPropertyTypes
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([, v]) => v !== undefined),
      );
      const property = await prisma.property.update({
        where: { id: propertyId },
        data: cleanUpdates,
      });

      res.json({ property });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to update property');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /:propertyId — soft delete (set status to INACTIVE)
// ---------------------------------------------------------------------------

propertiesRouter.delete(
  '/:propertyId',
  requireAuth,
  validateParams(propertyIdSchema),
  requireTenant,
  requireRole('OWNER'),
  auditLog({
    action: 'property.deactivate',
    resourceType: 'property',
    getResourceId: (req) => req.params['propertyId'],
  }),
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const { propertyId } = req.params as { propertyId: string };

    try {
      const existing = await prisma.property.findFirst({
        where: { id: propertyId, organizationId },
        select: { id: true },
      });

      if (!existing) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      await prisma.property.update({
        where: { id: propertyId },
        data: { status: 'INACTIVE' },
      });

      res.status(204).send();
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to deactivate property');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:propertyId/stats
// ---------------------------------------------------------------------------

propertiesRouter.get(
  '/:propertyId/stats',
  requireAuth,
  validateParams(propertyIdSchema),
  requireTenant,
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const { propertyId } = req.params as { propertyId: string };

    try {
      const property = await prisma.property.findFirst({
        where: { id: propertyId, organizationId },
        select: { id: true },
      });

      if (!property) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const now = new Date();
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );

      const [
        totalConversations,
        openEscalations,
        publishedKbItems,
        conversationsToday,
      ] = await Promise.all([
        prisma.conversation.count({ where: { propertyId } }),
        prisma.escalation.count({
          where: {
            status: { in: ['OPEN', 'IN_PROGRESS'] },
            conversation: { propertyId },
          },
        }),
        prisma.knowledgeItem.count({ where: { propertyId, isPublished: true } }),
        prisma.conversation.count({
          where: { propertyId, createdAt: { gte: startOfToday } },
        }),
      ]);

      res.json({
        stats: {
          totalConversations,
          openEscalations,
          publishedKbItems,
          conversationsToday,
        },
      });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to get property stats');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);
