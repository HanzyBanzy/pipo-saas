import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createRouter } from './routes/index.js';
import { logger } from './config/logger.js';

export function createApp(): Express {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS — allow dashboard in development
  app.use(cors({
    origin: process.env['DASHBOARD_URL'] ?? 'http://localhost:3000',
    credentials: true,
  }));

  // Trust proxy (for Railway/Render deployment)
  app.set('trust proxy', 1);

  // Body parsing — size limits prevent DoS
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  // Request logging
  app.use((req, _res, next) => {
    logger.info({ method: req.method, path: req.path }, 'Request');
    next();
  });

  // Health check — no auth
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api', createRouter());

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Error handler
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      logger.error({ err }, 'Unhandled error');
      res.status(500).json({ error: 'Internal server error' });
    },
  );

  return app;
}
