import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@pipo/db';
import { requireAuth } from '../../middleware/auth.js';
import { requireTenant } from '../../middleware/tenant.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { logger } from '../../config/logger.js';

export const chatRouter: RouterType = Router();

const propertyParamsSchema = z.object({
  propertyId: z.string().min(1),
});

const chatSchema = z.object({
  guestMessage: z.string().min(1).max(2000),
  guestName: z.string().min(1).max(100).default('Guest'),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    )
    .max(40)
    .default([]),
});

chatRouter.post(
  '/properties/:propertyId/test-chat',
  requireAuth,
  validateParams(propertyParamsSchema),
  requireTenant,
  validateBody(chatSchema),
  async (req, res) => {
    const { organizationId } = req.tenantScope!;
    const { propertyId } = req.params as { propertyId: string };
    const { guestMessage, guestName, conversationHistory } = req.body as z.infer<typeof chatSchema>;

    try {
      // Verify property belongs to org
      const property = await prisma.property.findFirst({
        where: { id: propertyId, organizationId },
        select: { id: true, name: true, timezone: true, defaultLanguage: true },
      });

      if (!property) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      // Fetch published AI-readable knowledge items
      const knowledgeItems = await prisma.knowledgeItem.findMany({
        where: {
          propertyId,
          isPublished: true,
          accessLevel: { in: ['PUBLIC', 'AI_READABLE'] },
        },
        select: { title: true, content: true, category: true },
        orderBy: { category: 'asc' },
      });

      // Build knowledge context
      const knowledgeContext = knowledgeItems.length > 0
        ? knowledgeItems
            .map((item) => `[${item.category}] ${item.title}\n${item.content}`)
            .join('\n\n')
        : 'No knowledge base items have been published yet.';

      const systemPrompt = `You are Pipo, a helpful AI concierge for ${property.name}.
You assist guests with questions about the property, check-in/out, amenities, and local area.
Be warm, friendly, and concise. If you don't know something, say so honestly.

Property Knowledge Base:
${knowledgeContext}

Important: Never share door codes, WiFi passwords, or any security credentials — direct guests to the host for those.
Always respond in the guest's language if possible.`;

      const client = new Anthropic({
        apiKey: process.env['ANTHROPIC_API_KEY'],
      });

      const messages: Anthropic.MessageParam[] = [
        ...conversationHistory.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        {
          role: 'user' as const,
          content: `Guest (${guestName}): ${guestMessage}`,
        },
      ];

      const response = await client.messages.create({
        model: process.env['ANTHROPIC_MODEL'] ?? 'claude-haiku-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      });

      const reply = response.content[0]?.type === 'text' ? response.content[0].text : '';

      res.json({ reply, propertyName: property.name });
    } catch (err: unknown) {
      logger.error({ err }, 'Test chat error');
      res.status(500).json({ error: 'Failed to get AI response' });
    }
  },
);
