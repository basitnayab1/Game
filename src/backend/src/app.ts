import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { env } from './config/env';
import { requestIdMiddleware } from './middleware/request-id';
import { requestObservabilityMiddleware } from './middleware/request-observability';
import { recordRequest } from './observability/runtime-metrics';
import { errorHandler } from './middleware/error-handler';
import { createApiRouter } from './routes';
import { createCashierRouter } from './modules/payments/cashier.routes.js';
import type { DatabaseClient } from './core/database/database.types';
import { createDatabaseClient } from './core/database/postgres.client';

export function createApp(db?: DatabaseClient) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
  const corsOrigins = env.CORS_ORIGIN === '*'
    ? true
    : env.CORS_ORIGIN.includes(',')
      ? env.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
      : env.CORS_ORIGIN;
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb', verify: (req, _res, buf) => { (req as any).rawBody = buf.toString('utf8'); } }));
  app.use(express.urlencoded({ extended: true, limit: '1mb', verify: (req, _res, buf) => { (req as any).rawBody = (req as any).rawBody || buf.toString('utf8'); } }));
  app.use(requestIdMiddleware);
  app.use(requestObservabilityMiddleware);
  app.use((_req, res, next) => {
    res.on('finish', () => recordRequest(res.statusCode));
    next();
  });

  if (db) {
    app.locals.db = db;
  }

  const publicDir = fs.existsSync(path.resolve(process.cwd(), 'public'))
    ? path.resolve(process.cwd(), 'public')
    : path.resolve(__dirname, '../public');

  if (fs.existsSync(publicDir)) {
    app.use('/public', express.static(publicDir));
    app.get('/admin', (_req, res) => res.sendFile(path.join(publicDir, 'admin.html')));
    app.get('/admin-portal', (_req, res) => res.sendFile(path.join(publicDir, 'admin.html')));
    app.get('/dashboard', (_req, res) => res.sendFile(path.join(publicDir, 'admin.html')));
    app.get('/lobby', (_req, res) => res.sendFile(path.join(publicDir, 'lobby.html')));
    app.get('/portal', (_req, res) => res.sendFile(path.join(publicDir, 'lobby.html')));
    app.get('/casino', (_req, res) => res.sendFile(path.join(publicDir, 'lobby.html')));
    app.get('/games/play', (_req, res) => res.sendFile(path.join(publicDir, 'game.html')));
    app.get('/play', (_req, res) => res.sendFile(path.join(publicDir, 'game.html')));
    app.get('/games/aviator', (_req, res) => res.sendFile(path.join(publicDir, 'aviator.html')));
    app.get('/games/crash', (_req, res) => res.sendFile(path.join(publicDir, 'aviator.html')));
    app.get('/aviator', (_req, res) => res.sendFile(path.join(publicDir, 'aviator.html')));
  }

  const adminDistCandidates = [
    path.resolve(process.cwd(), 'admin/dist'),
    path.resolve(process.cwd(), '../admin/dist'),
    path.resolve(__dirname, '../../admin/dist'),
    path.resolve(__dirname, '../admin/dist'),
  ];
  const adminDist = adminDistCandidates.find((p) => fs.existsSync(p));
  if (adminDist) {
    app.use('/admin', express.static(adminDist));
    app.get('/admin', (_req, res) => res.sendFile(path.join(adminDist, 'index.html')));
    app.get('/admin/*', (_req, res) => res.sendFile(path.join(adminDist, 'index.html')));
  }

  const apkCandidates = [
    path.resolve(process.cwd(), '../../N5-Mobile-App.apk'),
    path.resolve(process.cwd(), '../N5-Mobile-App.apk'),
    path.resolve(process.cwd(), 'N5-Mobile-App.apk'),
    path.resolve(process.cwd(), '../src/build/app/outputs/flutter-apk/app-release.apk'),
  ];
  app.get('/download', (_req, res) => {
    const found = apkCandidates.find((p) => fs.existsSync(p));
    if (found) {
      res.download(found, 'N5-Game-Mobile.apk');
    } else {
      res.status(404).send('APK file not found on server.');
    }
  });

  app.get('/', (_req, res) => res.json({ success: true, data: { name: env.APP_NAME, api: env.API_PREFIX }, requestId: res.locals.requestId }));
  app.use(env.API_PREFIX, createApiRouter());
  app.use('/payments', createCashierRouter());
  app.use(errorHandler);
  return app;
}
