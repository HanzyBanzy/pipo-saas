import { Router } from 'express';
import { clerkAuth } from '../middleware/auth.js';
import { apiRateLimit } from '../middleware/rateLimit.js';
import { organizationsRouter } from '../modules/organizations/organizations.router.js';
import { propertiesRouter } from '../modules/properties/properties.router.js';
import { knowledgeRouter } from '../modules/knowledge/knowledge.router.js';
import { secretsRouter } from '../modules/secrets/secrets.router.js';
import { chatRouter } from '../modules/chat/chat.router.js';
import { conversationsRouter } from '../modules/conversations/conversations.router.js';
import { escalationsRouter } from '../modules/escalations/escalations.router.js';

export function createRouter(): Router {
  const router = Router();

  router.use(clerkAuth);
  router.use(apiRateLimit);

  router.use('/organizations', organizationsRouter);
  router.use('/properties', propertiesRouter);

  // Nested under /properties/:propertyId or top-level org routes
  router.use('/', knowledgeRouter);
  router.use('/', secretsRouter);
  router.use('/', chatRouter);
  router.use('/', conversationsRouter);
  router.use('/', escalationsRouter);

  return router;
}
