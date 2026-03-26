import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '@pipo/db';
import { requireAuth } from '../../middleware/auth.js';
import { requireTenant, requireRole } from '../../middleware/tenant.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { auditLog } from '../../middleware/audit.js';
import { logger } from '../../config/logger.js';
import { sendEscalationEmail } from '../../lib/email.js';

export const escalationsRouter: RouterType = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const propertyParamsSchema = z.object({
  propertyId: z.string().min(1),
});

const escalationParamsSchema = z.object({
  escalationId: z.string().min(1),
});

const listQuerySchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED']).optional(),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  propertyId: z.string().optional(),
  limit: z
    .string()
    .transform((v) => Math.min(parseInt(v, 10) || 50, 100))
    .optional(),
  cursor: z.string().optional(),
});

const createEscalationSchema = z.object({
  conversationId: z.string().min(1),
  trigger: z.enum([
    'AI_REQUESTED',
    'KEYWORD_MATCH',
    'SENTIMENT_THRESHOLD',
    'TIMEOUT',
    'MANUAL',
    'SECURITY_VIOLATION',
  ]),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  reason: z.string().min(1).max(1000),
});

const updateEscalationSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED']).optional(),
  notes: z.string().max(5000).optional(),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
});

// ---------------------------------------------------------------------------
// GET /escalations  — org-level list
// ---------------------------------------------------------------------------

escalationsRouter.get(
  '/escalations',
  requireAuth,
  requireTenant,
  validateQuery(listQuerySchema),
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const query = req.query as z.infer<typeof listQuerySchema>;

    try {
      const limit = query.limit ?? 50;

      const escalations = await prisma.escalation.findMany({
        where: {
          conversation: {
            property: { organizationId },
            ...(query.propertyId && { propertyId: query.propertyId }),
          },
          ...(query.status && { status: query.status }),
          ...(query.urgency && { urgency: query.urgency }),
          ...(query.cursor && { id: { lt: query.cursor } }),
        },
        include: {
          conversation: {
            select: {
              id: true,
              guestName: true,
              channel: true,
              property: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [
          { urgency: 'desc' },
          { createdAt: 'desc' },
        ],
        take: limit + 1,
      });

      const hasMore = escalations.length > limit;
      const items = hasMore ? escalations.slice(0, limit) : escalations;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      res.json({ escalations: items, hasMore, nextCursor });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to list escalations');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /properties/:propertyId/escalations  — property-scoped list
// ---------------------------------------------------------------------------

escalationsRouter.get(
  '/properties/:propertyId/escalations',
  requireAuth,
  validateParams(propertyParamsSchema),
  requireTenant,
  validateQuery(listQuerySchema),
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const { propertyId } = req.params as { propertyId: string };
    const query = req.query as z.infer<typeof listQuerySchema>;

    try {
      const property = await prisma.property.findFirst({
        where: { id: propertyId, organizationId },
        select: { id: true },
      });
      if (!property) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const limit = query.limit ?? 50;

      const escalations = await prisma.escalation.findMany({
        where: {
          conversation: { propertyId },
          ...(query.status && { status: query.status }),
          ...(query.urgency && { urgency: query.urgency }),
          ...(query.cursor && { id: { lt: query.cursor } }),
        },
        include: {
          conversation: {
            select: {
              id: true,
              guestName: true,
              channel: true,
            },
          },
        },
        orderBy: [
          { urgency: 'desc' },
          { createdAt: 'desc' },
        ],
        take: limit + 1,
      });

      const hasMore = escalations.length > limit;
      const items = hasMore ? escalations.slice(0, limit) : escalations;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      res.json({ escalations: items, hasMore, nextCursor });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to list property escalations');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /escalations  — create
// ---------------------------------------------------------------------------

escalationsRouter.post(
  '/escalations',
  requireAuth,
  requireTenant,
  validateBody(createEscalationSchema),
  auditLog({ action: 'escalation.create', resourceType: 'escalation' }),
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const data = req.body as z.infer<typeof createEscalationSchema>;

    try {
      // Verify conversation belongs to this org
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: data.conversationId,
          property: { organizationId },
        },
        select: { id: true },
      });

      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      const escalation = await prisma.escalation.create({
        data: {
          conversationId: data.conversationId,
          trigger: data.trigger,
          urgency: data.urgency,
          reason: data.reason,
        },
        include: {
          conversation: {
            select: {
              guestName: true,
              propertyId: true,
              property: { select: { name: true } },
            },
          },
        },
      });

      // Mark conversation as escalated
      await prisma.conversation.update({
        where: { id: data.conversationId },
        data: { status: 'ESCALATED' },
      });

      // Send email notification
      const hostEmail = process.env['HOST_NOTIFICATION_EMAIL'];
      if (hostEmail) {
        void sendEscalationEmail({
          to: hostEmail,
          propertyName: escalation.conversation.property.name,
          guestName: escalation.conversation.guestName ?? 'Guest',
          reason: escalation.reason,
          urgency: escalation.urgency,
          conversationId: escalation.conversationId,
          propertyId: escalation.conversation.propertyId,
        });
      }

      res.status(201).json({ escalation });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to create escalation');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /escalations/:escalationId  — update status / notes
// ---------------------------------------------------------------------------

escalationsRouter.patch(
  '/escalations/:escalationId',
  requireAuth,
  validateParams(escalationParamsSchema),
  requireTenant,
  requireRole('OWNER', 'ADMIN', 'MEMBER'),
  validateBody(updateEscalationSchema),
  auditLog({
    action: 'escalation.update',
    resourceType: 'escalation',
    getResourceId: (req) => req.params['escalationId'],
  }),
  async (req, res) => {
    const { organizationId, userId } = req.tenantScope!;
    const { escalationId } = req.params as { escalationId: string };
    const updates = req.body as z.infer<typeof updateEscalationSchema>;

    try {
      const escalation = await prisma.escalation.findFirst({
        where: {
          id: escalationId,
          conversation: { property: { organizationId } },
        },
        select: { id: true, status: true },
      });

      if (!escalation) {
        res.status(404).json({ error: 'Escalation not found' });
        return;
      }

      const isResolving =
        updates.status === 'RESOLVED' || updates.status === 'DISMISSED';

      if (isResolving && (escalation.status === 'RESOLVED' || escalation.status === 'DISMISSED')) {
        res.status(409).json({ error: `Escalation is already ${escalation.status.toLowerCase()}` });
        return;
      }

      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([, v]) => v !== undefined),
      );

      if (Object.keys(cleanUpdates).length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      const updated = await prisma.escalation.update({
        where: { id: escalationId },
        data: {
          ...cleanUpdates,
          ...(isResolving && {
            resolvedById: userId,
            resolvedAt: new Date(),
          }),
          ...(!isResolving &&
            updates.status && {
              resolvedById: null,
              resolvedAt: null,
            }),
        },
        include: {
          conversation: {
            select: { id: true, guestName: true },
          },
        },
      });

      res.json({ escalation: updated });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to update escalation');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);
