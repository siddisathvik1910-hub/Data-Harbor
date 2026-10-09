import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { errorHandler, notFound } from './middleware/error.js';
import authRouter, { adminAuthRouter } from './routes/auth.js';
import adminRouter from './routes/admin.js';
import datasetsRouter from './routes/datasets.js';
import accessRequestsRouter, { datasetAccessRouter } from './routes/accessRequests.js';
import notificationsRouter from './routes/notifications.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  if (config.isProd) app.set('trust proxy', 1); // needed for correct client IPs behind a reverse proxy

  app.use(helmet());
  app.use(
    cors({
      // Only the two portals may call this API (with cookies).
      origin: [config.adminOrigin, config.userOrigin],
      credentials: true,
      exposedHeaders: ['Content-Disposition'],
    })
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // General limiter for the whole API + a much stricter one for credential endpoints.
  app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 1000, standardHeaders: true, legacyHeaders: false }));
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please try again in a few minutes.' },
  });
  app.use(['/api/auth/login', '/api/auth/signup', '/api/admin/auth/login'], authLimiter);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRouter);
  app.use('/api/admin/auth', adminAuthRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/datasets/:datasetId/access-requests', datasetAccessRouter);
  app.use('/api/datasets', datasetsRouter);
  app.use('/api/access-requests', accessRequestsRouter);
  app.use('/api/notifications', notificationsRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
