import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@pipo/db';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { chatRateLimit } from '../../middleware/rateLimit.js';
import { logger } from '../../config/logger.js';
import { sendEscalationEmail } from '../../lib/email.js';

export const widgetRouter: RouterType = Router();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const widgetParamsSchema = z.object({
  propertyId: z.string().min(1),
});

const widgetConversationParamsSchema = z.object({
  propertyId: z.string().min(1),
  conversationId: z.string().min(1),
});

const widgetChatSchema = z.object({
  guestMessage: z.string().min(1).max(2000),
  guestName: z.string().min(1).max(100).default('Guest'),
  conversationId: z.string().optional(),
});

const messagesQuerySchema = z.object({
  since: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Escalation signal parsing
// ---------------------------------------------------------------------------

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
// POST /widget/:propertyId/chat
// ---------------------------------------------------------------------------

widgetRouter.post(
  '/widget/:propertyId/chat',
  chatRateLimit,
  validateParams(widgetParamsSchema),
  validateBody(widgetChatSchema),
  async (req, res) => {
    const { propertyId } = req.params as { propertyId: string };
    const { guestMessage, guestName, conversationId } =
      req.body as z.infer<typeof widgetChatSchema>;

    try {
      // Verify property exists and AI is enabled
      const property = await prisma.property.findFirst({
        where: { id: propertyId },
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

      if (!property.aiEnabled) {
        res.status(403).json({ error: 'AI is not enabled for this property' });
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

      // Check for open escalation (human takeover mode)
      const openEscalation = await prisma.escalation.findFirst({
        where: {
          conversationId: activeConversationId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
        select: { id: true },
      });

      // Save guest message regardless
      await prisma.message.create({
        data: {
          conversationId: activeConversationId,
          role: 'GUEST',
          content: guestMessage,
        },
      });

      await prisma.conversation.update({
        where: { id: activeConversationId },
        data: { updatedAt: new Date() },
      });

      if (openEscalation) {
        // Staff/human takeover mode — don't call AI
        // Check for any recent STAFF messages to return
        const recentStaffMessages = await prisma.message.findMany({
          where: {
            conversationId: activeConversationId,
            role: 'STAFF',
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, createdAt: true },
        });

        logger.info(
          { conversationId: activeConversationId },
          'Widget chat in staff mode — skipping AI',
        );

        res.json({
          reply: null,
          staffMode: true,
          conversationId: activeConversationId,
          latestStaffMessage: recentStaffMessages[0] ?? null,
        });
        return;
      }

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

      const systemPrompt = `You are Pipo, a Personal House Companion for ${property.name}.
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
      // Build conversation history from DB
      // -----------------------------------------------------------------------
      const recentMessages = await prisma.message.findMany({
        where: {
          conversationId: activeConversationId,
          role: { in: ['GUEST', 'AI'] },
        },
        orderBy: { createdAt: 'asc' },
        take: 40,
        select: { role: true, content: true },
      });

      // Exclude the message we just saved (last one)
      const historyMessages = recentMessages.slice(0, -1);

      const messages: Anthropic.MessageParam[] = [
        ...historyMessages.map((m) => ({
          role: m.role === 'GUEST' ? ('user' as const) : ('assistant' as const),
          content: m.content,
        })),
        {
          role: 'user' as const,
          content: `${guestName}: ${guestMessage}`,
        },
      ];

      // -----------------------------------------------------------------------
      // Call Claude
      // -----------------------------------------------------------------------
      const client = new Anthropic({ apiKey: process.env['ANTHROPIC_API_KEY'] });

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

      // -----------------------------------------------------------------------
      // Create escalation if signalled
      // -----------------------------------------------------------------------
      let escalated = false;
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
            await prisma.escalation.create({
              data: {
                conversationId: activeConversationId,
                trigger: 'AI_REQUESTED',
                urgency: 'HIGH',
                reason: escalationReason,
              },
            });

            logger.info(
              { conversationId: activeConversationId, reason: escalationReason },
              'Escalation created from widget chat',
            );

            // Send email notification
            const hostEmail = process.env['HOST_NOTIFICATION_EMAIL'];
            if (hostEmail) {
              void sendEscalationEmail({
                to: hostEmail,
                propertyName: property.name,
                guestName,
                reason: escalationReason,
                urgency: 'HIGH',
                conversationId: activeConversationId,
                propertyId,
              });
            }
          }

          await prisma.conversation.update({
            where: { id: activeConversationId },
            data: { status: 'ESCALATED' },
          });

          escalated = true;
        } catch (escErr) {
          logger.error({ escErr }, 'Failed to create escalation record');
        }
      }

      res.json({
        reply,
        conversationId: activeConversationId,
        escalated,
        staffMode: false,
      });
    } catch (err: unknown) {
      logger.error({ err }, 'Widget chat error');
      res.status(500).json({ error: 'Failed to get AI response' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /widget/:propertyId/conversations/:conversationId/messages?since=<ISO>
// ---------------------------------------------------------------------------

widgetRouter.get(
  '/widget/:propertyId/conversations/:conversationId/messages',
  chatRateLimit,
  validateParams(widgetConversationParamsSchema),
  validateQuery(messagesQuerySchema),
  async (req, res) => {
    const { propertyId, conversationId } = req.params as {
      propertyId: string;
      conversationId: string;
    };
    const query = req.query as z.infer<typeof messagesQuerySchema>;

    try {
      // Verify conversation belongs to property
      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, propertyId },
        select: { id: true },
      });

      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      const sinceDate = query.since ? new Date(query.since) : undefined;

      const messages = await prisma.message.findMany({
        where: {
          conversationId,
          ...(sinceDate && { createdAt: { gt: sinceDate } }),
        },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          role: true,
          content: true,
          createdAt: true,
        },
      });

      // Check staff mode
      const openEscalation = await prisma.escalation.findFirst({
        where: {
          conversationId,
          status: { in: ['OPEN', 'IN_PROGRESS'] },
        },
        select: { id: true },
      });

      res.json({
        messages,
        staffMode: openEscalation !== null,
      });
    } catch (err: unknown) {
      logger.error({ err }, 'Widget messages error');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);
