import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '@pipo/db';
import { requireAuth } from '../../middleware/auth.js';
import { requireTenant } from '../../middleware/tenant.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { logger } from '../../config/logger.js';

export const conversationsRouter: RouterType = Router({ mergeParams: true });

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const propertyParamsSchema = z.object({
  propertyId: z.string().min(1),
});

const conversationParamsSchema = z.object({
  propertyId: z.string().min(1),
  conversationId: z.string().min(1),
});

const listQuerySchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'ESCALATED', 'ARCHIVED']).optional(),
  channel: z.enum(['WEB_CHAT', 'WHATSAPP', 'LINE', 'EMAIL', 'SMS', 'DIRECT']).optional(),
  limit: z
    .string()
    .transform((v) => Math.min(parseInt(v, 10) || 50, 100))
    .optional(),
  cursor: z.string().optional(),
});

const createConversationSchema = z.object({
  channel: z.enum(['WEB_CHAT', 'WHATSAPP', 'LINE', 'EMAIL', 'SMS', 'DIRECT']).default('WEB_CHAT'),
  guestName: z.string().max(200).optional(),
  guestIdentifier: z.string().max(200).optional(),
  language: z.string().length(2).default('en'),
  externalConversationId: z.string().optional(),
});

const updateConversationSchema = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'ESCALATED', 'ARCHIVED']).optional(),
  guestName: z.string().max(200).optional(),
  notes: z.string().optional(),
});

const addMessageSchema = z.object({
  role: z.enum(['GUEST', 'AI', 'STAFF', 'SYSTEM']),
  content: z.string().min(1).max(50000),
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function verifyPropertyAccess(propertyId: string, organizationId: string): Promise<boolean> {
  const p = await prisma.property.findFirst({
    where: { id: propertyId, organizationId },
    select: { id: true },
  });
  return p !== null;
}

// ---------------------------------------------------------------------------
// GET /properties/:propertyId/conversations  — list
// ---------------------------------------------------------------------------

conversationsRouter.get(
  '/properties/:propertyId/conversations',
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

      const limit = query.limit ?? 50;

      const conversations = await prisma.conversation.findMany({
        where: {
          propertyId,
          ...(query.status && { status: query.status }),
          ...(query.channel && { channel: query.channel }),
          ...(query.cursor && { id: { lt: query.cursor } }),
        },
        select: {
          id: true,
          channel: true,
          status: true,
          guestName: true,
          guestIdentifier: true,
          language: true,
          resolvedAt: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { messages: true, escalations: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { role: true, content: true, createdAt: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = conversations.length > limit;
      const items = hasMore ? conversations.slice(0, limit) : conversations;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      res.json({ conversations: items, hasMore, nextCursor });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to list conversations');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /properties/:propertyId/conversations  — create
// ---------------------------------------------------------------------------

conversationsRouter.post(
  '/properties/:propertyId/conversations',
  requireAuth,
  validateParams(propertyParamsSchema),
  requireTenant,
  validateBody(createConversationSchema),
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const { propertyId } = req.params as { propertyId: string };
    const data = req.body as z.infer<typeof createConversationSchema>;

    try {
      const hasAccess = await verifyPropertyAccess(propertyId, organizationId);
      if (!hasAccess) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const conversation = await prisma.conversation.create({
        data: {
          propertyId,
          channel: data.channel,
          guestName: data.guestName,
          guestIdentifier: data.guestIdentifier,
          language: data.language,
          externalConversationId: data.externalConversationId,
        },
      });

      res.status(201).json({ conversation });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to create conversation');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /properties/:propertyId/conversations/:conversationId  — detail
// ---------------------------------------------------------------------------

conversationsRouter.get(
  '/properties/:propertyId/conversations/:conversationId',
  requireAuth,
  validateParams(conversationParamsSchema),
  requireTenant,
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const { propertyId, conversationId } = req.params as {
      propertyId: string;
      conversationId: string;
    };

    try {
      const hasAccess = await verifyPropertyAccess(propertyId, organizationId);
      if (!hasAccess) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, propertyId },
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
          escalations: { orderBy: { createdAt: 'desc' } },
        },
      });

      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      res.json({ conversation });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to get conversation');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /properties/:propertyId/conversations/:conversationId  — update status
// ---------------------------------------------------------------------------

conversationsRouter.patch(
  '/properties/:propertyId/conversations/:conversationId',
  requireAuth,
  validateParams(conversationParamsSchema),
  requireTenant,
  validateBody(updateConversationSchema),
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const { propertyId, conversationId } = req.params as {
      propertyId: string;
      conversationId: string;
    };
    const updates = req.body as z.infer<typeof updateConversationSchema>;

    try {
      const hasAccess = await verifyPropertyAccess(propertyId, organizationId);
      if (!hasAccess) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const existing = await prisma.conversation.findFirst({
        where: { id: conversationId, propertyId },
        select: { id: true },
      });

      if (!existing) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([, v]) => v !== undefined),
      );

      const conversation = await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          ...cleanUpdates,
          ...(updates.status === 'RESOLVED' && { resolvedAt: new Date() }),
          ...(updates.status && updates.status !== 'RESOLVED' && { resolvedAt: null }),
        },
      });

      res.json({ conversation });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to update conversation');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /properties/:propertyId/conversations/:conversationId/messages  — add message
// ---------------------------------------------------------------------------

conversationsRouter.post(
  '/properties/:propertyId/conversations/:conversationId/messages',
  requireAuth,
  validateParams(conversationParamsSchema),
  requireTenant,
  validateBody(addMessageSchema),
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const { propertyId, conversationId } = req.params as {
      propertyId: string;
      conversationId: string;
    };
    const data = req.body as z.infer<typeof addMessageSchema>;

    try {
      const hasAccess = await verifyPropertyAccess(propertyId, organizationId);
      if (!hasAccess) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      const conv = await prisma.conversation.findFirst({
        where: { id: conversationId, propertyId },
        select: { id: true },
      });

      if (!conv) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      const message = await prisma.message.create({
        data: {
          conversationId,
          role: data.role,
          content: data.content,
        },
      });

      // Keep conversation updatedAt fresh
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });

      res.status(201).json({ message });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to add message');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /conversations  — org-level list (across all properties)
// ---------------------------------------------------------------------------

conversationsRouter.get(
  '/conversations',
  requireAuth,
  requireTenant,
  validateQuery(listQuerySchema),
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const query = req.query as z.infer<typeof listQuerySchema>;

    try {
      const limit = query.limit ?? 50;

      const conversations = await prisma.conversation.findMany({
        where: {
          property: { organizationId },
          ...(query.status && { status: query.status }),
          ...(query.channel && { channel: query.channel }),
          ...(query.cursor && { id: { lt: query.cursor } }),
        },
        select: {
          id: true,
          propertyId: true,
          channel: true,
          status: true,
          guestName: true,
          language: true,
          resolvedAt: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { messages: true, escalations: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { role: true, content: true, createdAt: true },
          },
          property: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit + 1,
      });

      const hasMore = conversations.length > limit;
      const items = hasMore ? conversations.slice(0, limit) : conversations;
      const nextCursor = hasMore ? items[items.length - 1]?.id : undefined;

      res.json({ conversations: items, hasMore, nextCursor });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to list org conversations');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);
