import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import { getAuth } from '@clerk/express';
import { prisma } from '@pipo/db';
import { requireAuth } from '../../middleware/auth.js';
import { requireTenant, requireRole } from '../../middleware/tenant.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { auditLog } from '../../middleware/audit.js';
import { logger } from '../../config/logger.js';

export const organizationsRouter: RouterType = Router();

const DEV_TOKEN = 'dev-token';
const isDev = process.env['NODE_ENV'] !== 'production';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const createOrgSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
});

const updateOrgSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  slug: z
    .string()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

const orgIdSchema = z.object({
  orgId: z.string().min(1),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']).default('MEMBER'),
});

const memberIdSchema = z.object({
  orgId: z.string().min(1),
  userId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// GET / — list organizations for current user
// ---------------------------------------------------------------------------

organizationsRouter.get('/', requireAuth, async (req, res) => {
  const bearer = (req.headers['authorization'] ?? '').replace('Bearer ', '');
  const isDevRequest = isDev && bearer === DEV_TOKEN;

  try {
    let userId: string;

    if (isDevRequest) {
      const devUser = await prisma.user.findFirst({ select: { id: true } });
      if (!devUser) {
        res.status(500).json({ error: 'No user in database. Run: pnpm db:seed' });
        return;
      }
      userId = devUser.id;
    } else {
      const auth = getAuth(req);
      const user = await prisma.user.findUnique({
        where: { clerkId: auth.userId! },
        select: { id: true },
      });
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      userId = user.id;
    }

    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            plan: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const organizations = memberships.map((m) => ({
      ...m.organization,
      role: m.role,
    }));

    res.json({ organizations });
  } catch (err: unknown) {
    logger.error({ err }, 'Failed to list organizations');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST / — create organization
// ---------------------------------------------------------------------------

organizationsRouter.post(
  '/',
  requireAuth,
  validateBody(createOrgSchema),
  async (req, res) => {
    const auth = getAuth(req);
    const { name, slug } = req.body as z.infer<typeof createOrgSchema>;

    try {
      // Look up or create Pipo user from Clerk identity
      let user = await prisma.user.findUnique({
        where: { clerkId: auth.userId! },
        select: { id: true },
      });

      if (!user) {
        // Provision user record on first use
        user = await prisma.user.create({
          data: {
            clerkId: auth.userId!,
            email: `clerk_${auth.userId}@placeholder.pipo`,
          },
          select: { id: true },
        });
      }

      // Check slug uniqueness
      const existing = await prisma.organization.findUnique({
        where: { slug },
        select: { id: true },
      });

      if (existing) {
        res.status(409).json({ error: 'Slug already taken' });
        return;
      }

      // Create org and owner membership atomically
      const org = await prisma.$transaction(async (tx) => {
        const created = await tx.organization.create({
          data: { name, slug, plan: 'TRIAL' },
        });
        await tx.organizationMember.create({
          data: {
            organizationId: created.id,
            userId: user!.id,
            role: 'OWNER',
            acceptedAt: new Date(),
          },
        });
        return created;
      });

      logger.info({ orgId: org.id, userId: user.id }, 'Organization created');
      res.status(201).json({ organization: org });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to create organization');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:orgId — get organization details
// ---------------------------------------------------------------------------

organizationsRouter.get(
  '/:orgId',
  requireAuth,
  validateParams(orgIdSchema),
  requireTenant,
  async (req, res) => {
    const { orgId } = req.params as { orgId: string };

    try {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { properties: true, members: true },
          },
        },
      });

      if (!org) {
        res.status(404).json({ error: 'Organization not found' });
        return;
      }

      res.json({ organization: { ...org, role: req.tenantScope!.role } });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to get organization');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// PATCH /:orgId — update org
// ---------------------------------------------------------------------------

organizationsRouter.patch(
  '/:orgId',
  requireAuth,
  validateParams(orgIdSchema),
  requireTenant,
  requireRole('OWNER', 'ADMIN'),
  validateBody(updateOrgSchema),
  auditLog({ action: 'organization.update', resourceType: 'organization', getResourceId: (req) => req.params['orgId'] }),
  async (req, res) => {
    const { orgId } = req.params as { orgId: string };
    const updates = req.body as z.infer<typeof updateOrgSchema>;

    try {
      if (updates.slug) {
        const existing = await prisma.organization.findFirst({
          where: { slug: updates.slug, NOT: { id: orgId } },
          select: { id: true },
        });
        if (existing) {
          res.status(409).json({ error: 'Slug already taken' });
          return;
        }
      }

      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([, v]) => v !== undefined),
      );
      const org = await prisma.organization.update({
        where: { id: orgId },
        data: cleanUpdates,
      });

      res.json({ organization: org });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to update organization');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:orgId/members — list members
// ---------------------------------------------------------------------------

organizationsRouter.get(
  '/:orgId/members',
  requireAuth,
  validateParams(orgIdSchema),
  requireTenant,
  async (req, res) => {
    const { orgId } = req.params as { orgId: string };

    try {
      const members = await prisma.organizationMember.findMany({
        where: { organizationId: orgId },
        include: {
          user: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      res.json({
        members: members.map((m) => ({
          id: m.id,
          role: m.role,
          acceptedAt: m.acceptedAt,
          createdAt: m.createdAt,
          user: m.user,
        })),
      });
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to list members');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// POST /:orgId/members/invite
// ---------------------------------------------------------------------------

organizationsRouter.post(
  '/:orgId/members/invite',
  requireAuth,
  validateParams(orgIdSchema),
  requireTenant,
  requireRole('OWNER', 'ADMIN'),
  validateBody(inviteMemberSchema),
  auditLog({ action: 'member.invite', resourceType: 'organization', getResourceId: (req) => req.params['orgId'] }),
  async (req, res) => {
    const { orgId } = req.params as { orgId: string };
    const { email, role } = req.body as z.infer<typeof inviteMemberSchema>;

    try {
      // Check if a user with this email already exists
      let targetUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });

      if (targetUser) {
        // Check if already a member
        const existing = await prisma.organizationMember.findUnique({
          where: {
            organizationId_userId: {
              organizationId: orgId,
              userId: targetUser.id,
            },
          },
        });
        if (existing) {
          res.status(409).json({ error: 'User is already a member' });
          return;
        }

        // Add them directly
        const member = await prisma.organizationMember.create({
          data: {
            organizationId: orgId,
            userId: targetUser.id,
            role,
            invitedEmail: email,
          },
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
        });

        res.status(201).json({ member, invited: false });
      } else {
        // Create placeholder user record for pending invite
        targetUser = await prisma.user.create({
          data: {
            clerkId: `pending_${Date.now()}_${email}`,
            email,
          },
          select: { id: true },
        });

        const member = await prisma.organizationMember.create({
          data: {
            organizationId: orgId,
            userId: targetUser.id,
            role,
            invitedEmail: email,
            acceptedAt: null,
          },
        });

        logger.info({ orgId, email, role }, 'Invite created for new user');
        res.status(201).json({
          member: { ...member, user: { email } },
          invited: true,
          message: 'Invite created. Email delivery is not yet implemented.',
        });
      }
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to invite member');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /:orgId/members/:userId
// ---------------------------------------------------------------------------

organizationsRouter.delete(
  '/:orgId/members/:userId',
  requireAuth,
  validateParams(memberIdSchema),
  requireTenant,
  requireRole('OWNER'),
  auditLog({ action: 'member.remove', resourceType: 'organization', getResourceId: (req) => req.params['orgId'] }),
  async (req, res) => {
    const { orgId, userId } = req.params as { orgId: string; userId: string };
    const scope = req.tenantScope!;

    try {
      // Cannot remove yourself if you are the last owner
      if (userId === scope.userId) {
        const ownerCount = await prisma.organizationMember.count({
          where: { organizationId: orgId, role: 'OWNER' },
        });
        if (ownerCount <= 1) {
          res
            .status(400)
            .json({ error: 'Cannot remove the last owner from the organization' });
          return;
        }
      }

      const membership = await prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId: orgId, userId },
        },
      });

      if (!membership) {
        res.status(404).json({ error: 'Member not found' });
        return;
      }

      await prisma.organizationMember.delete({
        where: { id: membership.id },
      });

      res.status(204).send();
    } catch (err: unknown) {
      logger.error({ err }, 'Failed to remove member');
      res.status(500).json({ error: 'Internal server error' });
    }
  },
);
