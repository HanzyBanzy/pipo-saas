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
  conversationId: z.string().optional(),
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

// ---------------------------------------------------------------------------
// Escalation signal parsing
// ---------------------------------------------------------------------------
// Claude prepends [ESCALATE: <reason>] when it needs a human.
// We strip it from the visible reply and create a DB escalation record.

const ESCALATE_REGEX = /^\[ESCALATE:\s*(.+?)\]\s*/i;

function parseEscalation(text: string): { reply: string; escalationReason: string | null } {
  const match = ESCALATE_REGEX.exec(text);
  if (match) {
    return {
      reply: text.replace(ESCALATE_REGEX, '').trim(),
      escalationReason: match[1]?.trim() ?? 'Human assistance needed',
    };
  }
  return { reply: text, escalationReason: null };
}

// ---------------------------------------------------------------------------
// POST /properties/:propertyId/test-chat
// ---------------------------------------------------------------------------

chatRouter.post(
  '/properties/:propertyId/test-chat',
  requireAuth,
  validateParams(propertyParamsSchema),
  requireTenant,
  validateBody(chatSchema),
  async (req, res) => {
    const { organizationId, userId } = req.tenantScope!;
    const { propertyId } = req.params as { propertyId: string };
    const { guestMessage, guestName, conversationId, conversationHistory } =
      req.body as z.infer<typeof chatSchema>;

    try {
      // Verify property belongs to org
      const property = await prisma.property.findFirst({
        where: { id: propertyId, organizationId },
        select: {
          id: true,
          name: true,
          timezone: true,
          defaultLanguage: true,
          personalityMode: true,
          systemPromptExtra: true,
          aiEnabled: true,
        },
      });

      if (!property) {
        res.status(404).json({ error: 'Property not found' });
        return;
      }

      // -----------------------------------------------------------------------
      // Resolve or create conversation
      // -----------------------------------------------------------------------
      let conversation = conversationId
        ? await prisma.conversation.findFirst({
            where: { id: conversationId, propertyId },
            select: { id: true, status: true },
          })
        : null;

      if (conversationId && !conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            propertyId,
            channel: 'WEB_CHAT',
            guestName,
            language: property.defaultLanguage ?? 'en',
          },
          select: { id: true, status: true },
        });
      }

      const activeConversationId = conversation.id;

      // Save guest message
      await prisma.message.create({
        data: {
          conversationId: activeConversationId,
          role: 'GUEST',
          content: guestMessage,
        },
      });

      // -----------------------------------------------------------------------
      // Build system prompt
      // -----------------------------------------------------------------------
      const knowledgeItems = await prisma.knowledgeItem.findMany({
        where: {
          propertyId,
          isPublished: true,
          accessLevel: { in: ['PUBLIC', 'AI_READABLE'] },
        },
        select: { title: true, content: true, category: true },
        orderBy: { category: 'asc' },
      });

      const knowledgeContext =
        knowledgeItems.length > 0
          ? knowledgeItems
              .map((item) => `[${item.category}] ${item.title}\n${item.content}`)
              .join('\n\n')
          : 'No knowledge base items have been published yet.';

      const personalityNote =
        property.personalityMode === 'PROFESSIONAL'
          ? 'Respond formally and efficiently.'
          : property.personalityMode === 'MINIMAL'
          ? 'Keep responses very short and direct.'
          : property.personalityMode === 'FRIENDLY'
          ? 'Be casual, warm, and approachable.'
          : 'Be warm, gracious, and hospitality-focused.';

      const systemPrompt = `You are Pipo, an AI concierge for ${property.name}.
${personalityNote}
Be concise. If you don't know something, say so honestly.
Never share door codes, WiFi passwords, or security credentials — direct guests to the host for those.
Respond in the guest's language if possible.

## ESCALATION PROTOCOL
When you cannot confidently help the guest — for example: emergency situations, booking disputes, complex complaints, requests outside your knowledge, or any situation requiring real human judgement — you MUST begin your reply with this exact marker:
[ESCALATE: <brief reason in one sentence>]

Then continue with your response to the guest as normal. The host will be notified automatically.

Example: [ESCALATE: Guest reports a water leak and needs immediate assistance.]
I'm so sorry to hear that! I've alerted the host right away. Please ensure you're safe.

Only escalate when genuinely needed — not for every question.

## PROPERTY KNOWLEDGE BASE
${knowledgeContext}${property.systemPromptExtra ? `\n\n## ADDITIONAL INSTRUCTIONS\n${property.systemPromptExtra}` : ''}`;

      // -----------------------------------------------------------------------
      // Call Claude
      // -----------------------------------------------------------------------
      const client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });

      const messages: Anthropic.MessageParam[] = [
        ...conversationHistory.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        {
          role: 'user' as const,
          content: `${guestName}: ${guestMessage}`,
        },
      ];

      const startTime = Date.now();
      const response = await client.messages.create({
        model: process.env['ANTHROPIC_MODEL'] ?? 'claude-haiku-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      });

      const latencyMs = Date.now() - startTime;
      const rawReply =
        response.content[0]?.type === 'text' ? response.content[0].text : '';

      // -----------------------------------------------------------------------
      // Parse escalation signal
      // -----------------------------------------------------------------------
      const { reply, escalationReason } = parseEscalation(rawReply);

      // Save AI message
      await prisma.message.create({
        data: {
          conversationId: activeConversationId,
          role: 'AI',
          content: reply,
          tokensInput: response.usage.input_tokens,
          tokensOutput: response.usage.output_tokens,
          latencyMs,
        },
      });

      // Touch conversation updatedAt
      await prisma.conversation.update({
        where: { id: activeConversationId },
        data: { updatedAt: new Date() },
      });

      // -----------------------------------------------------------------------
      // Create escalation if signalled
      // -----------------------------------------------------------------------
      let escalation = null;
      if (escalationReason) {
        try {
          const existingEscalation = await prisma.escalation.findFirst({
            where: {
              conversationId: activeConversationId,
              status: { in: ['OPEN', 'IN_PROGRESS'] },
            },
            select: { id: true },
          });

          if (!existingEscalation) {
            escalation = await prisma.escalation.create({
              data: {
                conversationId: activeConversationId,
                trigger: 'AI_REQUESTED',
                urgency: 'HIGH',
                reason: escalationReason,
              },
            });

            logger.info(
              { conversationId: activeConversationId, reason: escalationReason },
              'Escalation created from test chat',
            );
          }

          await prisma.conversation.update({
            where: { id: activeConversationId },
            data: { status: 'ESCALATED' },
          });
        } catch (escErr) {
          logger.error({ escErr }, 'Failed to create escalation record');
        }
      }

      res.json({
        reply,
        propertyName: property.name,
        conversationId: activeConversationId,
        escalated: !!escalationReason,
        escalationReason: escalationReason ?? null,
      });
    } catch (err: unknown) {
      logger.error({ err }, 'Test chat error');
      res.status(500).json({ error: 'Failed to get AI response' });
    }
  },
);
