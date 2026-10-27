import { Router } from 'express';
import { readRuntimeMetrics } from '../observability/runtime-metrics.js';
import { checkDatabaseHealth } from '../core/database/postgres.client.js';
import type { DatabaseClient } from '../core/database/database.types.js';

export const healthRouter = Router();

// Liveness probe
healthRouter.get('/live', (_req, res) => {
  res.json({
    success: true,
    data: { service: 'n5-game-backend', status: 'live', timestamp: new Date().toISOString() },
    requestId: res.locals.requestId,
  });
});

// Readiness probe: reflects runtime database availability and health
healthRouter.get(['/ready', '/readiness'], async (req, res) => {
  const db = req.app.locals.db as DatabaseClient | undefined;
  if (!db) {
    return res.status(503).json({
      success: false,
      data: {
        service: 'n5-game-backend',
        status: 'unready',
        database: { status: 'disconnected', ready: false },
        timestamp: new Date().toISOString(),
      },
      requestId: res.locals.requestId,
    });
  }

  const dbHealth = await checkDatabaseHealth(db);
  if (!dbHealth.ok) {
    return res.status(503).json({
      success: false,
      data: {
        service: 'n5-game-backend',
        status: 'unready',
        database: { status: 'unhealthy', ready: false },
        timestamp: new Date().toISOString(),
      },
      requestId: res.locals.requestId,
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      service: 'n5-game-backend',
      status: 'ready',
      database: { status: 'connected', ready: true, latencyMs: dbHealth.latencyMs },
      timestamp: new Date().toISOString(),
    },
    requestId: res.locals.requestId,
  });
});

// Comprehensive health status
healthRouter.get('/', async (req, res) => {
  const db = req.app.locals.db as DatabaseClient | undefined;
  let dbStatus = 'disconnected';
  let isReady = false;
  let latencyMs: number | undefined;

  if (db) {
    const health = await checkDatabaseHealth(db);
    if (health.ok) {
      dbStatus = 'connected';
      isReady = true;
      latencyMs = health.latencyMs;
    } else {
      dbStatus = 'unhealthy';
    }
  }

  const hasOutage = Boolean(db && !isReady);
  const statusCode = hasOutage ? 503 : 200;

  res.status(statusCode).json({
    success: !hasOutage,
    data: {
      service: 'n5-game-backend',
      status: hasOutage ? 'degraded' : 'ok',
      database: { status: dbStatus, ready: isReady, latencyMs },
      timestamp: new Date().toISOString(),
      metrics: readRuntimeMetrics(),
    },
    requestId: res.locals.requestId,
  });
});
