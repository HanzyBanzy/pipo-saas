import { Redis } from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
});

redis.on('error', (err: unknown) =>
  logger.error({ err }, 'Redis connection error'),
);
redis.on('connect', () => logger.info('Redis connected'));
