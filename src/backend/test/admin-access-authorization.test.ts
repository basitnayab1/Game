import { describe, expect, it, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { AddressInfo } from 'node:net';
import { requireAdmin } from '../src/modules/admin/admin-access.middleware.js';
import { createApp } from '../src/app.js';
import { startServer } from '../src/server.js';
import type { DatabaseClient } from '../src/core/database/database.types.js';
import type { ConnectedDatabaseClient } from '../src/core/database/postgres.client.js';

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      return res;
    },
  };
  return res;
}

describe('Admin Authorization and Bypass Prevention', () => {
  it('denies unauthenticated request with 401 AUTHENTICATION_REQUIRED', async () => {
    const req: any = { auth: undefined, app: { locals: {} } };
    const res = createMockResponse();
    const next = vi.fn();

    await requireAdmin(req as Request, res as Response, next as NextFunction);

    expect(res.statusCode).toBe(401);
    expect(res.body?.error?.code).toBe('AUTHENTICATION_REQUIRED');
    expect(req.admin).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });

  it('never assigns super_admin when database is missing and fails closed with 503', async () => {
    // Regression check for the vulnerability where !db previously granted { role: 'super_admin' }
    const req: any = {
      auth: { userId: 'usr-ordinary-123' },
      app: { locals: { db: undefined } },
    };
    const res = createMockResponse();
    const next = vi.fn();

    await requireAdmin(req as Request, res as Response, next as NextFunction);

    expect(res.statusCode).toBe(503);
    expect(res.body?.ok).toBe(false);
    expect(res.body?.error?.code).toBe('DATABASE_UNAVAILABLE');
    expect(req.admin).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });

  it('denies access and never grants admin role when authorization query fails', async () => {
    const failingDb: DatabaseClient = {
      query: vi.fn().mockRejectedValue(new Error('connection terminated unexpectedly')),
      transaction: vi.fn(),
    };
    const req: any = {
      auth: { userId: 'usr-456' },
      app: { locals: { db: failingDb } },
    };
    const res = createMockResponse();
    const next = vi.fn();

    await requireAdmin(req as Request, res as Response, next as NextFunction);

    expect(res.statusCode).toBe(503);
    expect(res.body?.ok).toBe(false);
    expect(res.body?.error?.code).toBe('ADMIN_AUTH_CHECK_FAILED');
    expect(req.admin).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });

  it('denies access to ordinary non-admin user with 403 ADMIN_ACCESS_REQUIRED', async () => {
    const mockDb: DatabaseClient = {
      query: vi.fn().mockResolvedValue({ rows: [] }),
      transaction: vi.fn(),
    };
    const req: any = {
      auth: { userId: 'usr-regular-user' },
      app: { locals: { db: mockDb } },
    };
    const res = createMockResponse();
    const next = vi.fn();

    await requireAdmin(req as Request, res as Response, next as NextFunction);

    expect(res.statusCode).toBe(403);
    expect(res.body?.ok).toBe(false);
    expect(res.body?.error?.code).toBe('ADMIN_ACCESS_REQUIRED');
    expect(req.admin).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });

  it('denies access to inactive/suspended admin user with 403 ADMIN_ACCESS_REQUIRED', async () => {
    const mockDb: DatabaseClient = {
      query: vi.fn().mockResolvedValue({
        rows: [{ role: 'super_admin', status: 'suspended' }],
      }),
      transaction: vi.fn(),
    };
    const req: any = {
      auth: { userId: 'usr-suspended-admin' },
      app: { locals: { db: mockDb } },
    };
    const res = createMockResponse();
    const next = vi.fn();

    await requireAdmin(req as Request, res as Response, next as NextFunction);

    expect(res.statusCode).toBe(403);
    expect(res.body?.ok).toBe(false);
    expect(res.body?.error?.code).toBe('ADMIN_ACCESS_REQUIRED');
    expect(req.admin).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });

  it('allows valid active admin user and populates req.admin context', async () => {
    const mockDb: DatabaseClient = {
      query: vi.fn().mockResolvedValue({
        rows: [{ role: 'super_admin', status: 'active' }],
      }),
      transaction: vi.fn(),
    };
    const req: any = {
      auth: { userId: 'usr-verified-admin' },
      app: { locals: { db: mockDb } },
    };
    const res = createMockResponse();
    const next = vi.fn();

    await requireAdmin(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.admin).toEqual({
      userId: 'usr-verified-admin',
      role: 'super_admin',
    });
  });
});

describe('Runtime Database Health and Readiness', () => {
  it('reports unready (503) when database client is absent', async () => {
    const app = createApp(undefined);
    const server = app.listen(0);
    const port = (server.address() as AddressInfo).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/health/ready`);
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.data.status).toBe('unready');
      expect(data.data.database.status).toBe('disconnected');
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it('reports unready (503) during runtime database outage', async () => {
    const failingDb: DatabaseClient = {
      query: vi.fn().mockRejectedValue(new Error('DB connection pool exhausted')),
      transaction: vi.fn(),
    };
    const app = createApp(failingDb);
    const server = app.listen(0);
    const port = (server.address() as AddressInfo).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/health/ready`);
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.data.status).toBe('unready');
      expect(data.data.database.status).toBe('unhealthy');

      // Main health endpoint also reflects outage
      const mainHealthRes = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
      expect(mainHealthRes.status).toBe(503);
      const mainData = await mainHealthRes.json();
      expect(mainData.data.status).toBe('degraded');
      expect(mainData.data.database.status).toBe('unhealthy');
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  it('reports ready (200) when database is connected and healthy', async () => {
    const healthyDb: DatabaseClient = {
      query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
      transaction: vi.fn(),
    };
    const app = createApp(healthyDb);
    const server = app.listen(0);
    const port = (server.address() as AddressInfo).port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/v1/health/ready`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('ready');
      expect(data.data.database.ready).toBe(true);
      expect(data.data.database.status).toBe('connected');
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});

describe('Production Startup Database Enforcement and Pool Cleanup', () => {
  it('fails production startup when required database health check fails', async () => {
    // When production startup is attempted with an unreachable database URL
    await expect(
      startServer({
        nodeEnv: 'production',
        databaseUrl: 'postgres://nonexistent-user:wrong-pass@127.0.0.1:54329/n5_nonexistent',
        port: 0,
      }),
    ).rejects.toThrow(/\[DATABASE\]/);
  });

  it('fails staging startup when required database health check fails', async () => {
    await expect(
      startServer({
        nodeEnv: 'staging',
        databaseUrl: 'postgres://nonexistent-user:wrong-pass@127.0.0.1:54329/n5_nonexistent',
        port: 0,
      }),
    ).rejects.toThrow(/\[DATABASE\]/);
  });

  it('fails production startup when DATABASE_URL is missing', async () => {
    await expect(
      startServer({
        nodeEnv: 'production',
        databaseUrl: '',
        port: 0,
      }),
    ).rejects.toThrow(/DATABASE_URL is required/);
  });

  it('succeeds startup and performs pool cleanup on close when database is healthy', async () => {
    const closeMock = vi.fn().mockResolvedValue(undefined);
    const mockClient: ConnectedDatabaseClient = {
      pool: {} as any,
      query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
      transaction: vi.fn(),
      close: closeMock,
    };

    const running = await startServer({
      db: mockClient,
      port: 0,
    });

    expect(running.server).toBeDefined();
    await running.close();
    expect(closeMock).toHaveBeenCalledTimes(1);
  });
});
