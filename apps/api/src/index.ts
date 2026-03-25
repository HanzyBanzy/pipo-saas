import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { prisma } from '@pipo/db';

async function start(): Promise<void> {
  // Verify DB connection before accepting traffic
  await prisma.$connect();
  logger.info('Database connected');

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
