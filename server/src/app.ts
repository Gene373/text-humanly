import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { config, resolveEngine } from './config.ts';
import { logger } from './logger.ts';
import { attachUser } from './middleware/auth.ts';
import { errorHandler, notFoundHandler } from './middleware/errors.ts';
import { authRouter } from './routes/auth.ts';
import { simplifyRouter } from './routes/simplify.ts';
import { uploadRouter } from './routes/upload.ts';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  const allowedOrigins = new Set(
    [config.appUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'].filter(Boolean),
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(attachUser);

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      message: { error: 'rate_limited', message: 'Слишком много запросов. Подождите минуту.' },
    }),
  );

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString(), llm: resolveEngine() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api', simplifyRouter);
  app.use('/api', uploadRouter);

  // Если рядом лежит собранный клиент (client/dist) — раздаём его с того же origin.
  // Это упрощает деплой на PaaS: один сервис, без CORS и nginx.
  const clientDist = join(import.meta.dirname, '..', '..', 'client', 'dist');
  if (existsSync(join(clientDist, 'index.html'))) {
    app.use(
      express.static(clientDist, {
        index: false,
        setHeaders(res, filePath) {
          // Хешированные ассеты можно кешировать надолго.
          if (filePath.includes('assets')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );

    // SPA-роутинг: любой не-API путь отдаёт index.html.
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.sendFile(join(clientDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export { logger };
