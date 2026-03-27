import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from '@pipo/db';

async function seed(): Promise<void> {
  const hasClerkSetup = Boolean(process.env['CLERK_SECRET_KEY']?.startsWith('sk_live_'));
  if (hasClerkSetup) return; // real auth — don't auto-seed

  const existing = await prisma.organization.findFirst();
  if (existing) return;

  logger.info('Seeding initial organization and user...');
  const org = await prisma.organization.create({
    data: { name: 'Pipo House', slug: 'pipo-house' },
  });
  const user = await prisma.user.create({
    data: {
      clerkId: 'dev-user',
      email: 'rapipartvandersande@gmail.com',
      name: 'Hans',
      memberships: {
        create: { organizationId: org.id, role: 'OWNER' },
      },
    },
  });
  logger.info({ orgId: org.id, userId: user.id }, 'Seed complete');
}

async function start(): Promise<void> {
  // Verify DB connection before accepting traffic
  await prisma.$connect();
  logger.info('Database connected');
  await seed();

  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'Pipo API running');
  });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutting down');
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

start().catch((err: unknown) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
