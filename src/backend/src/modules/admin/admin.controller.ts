import { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import { AdminConfigService } from './admin.service.js';
import { PostgresAdminConfigRepository } from './admin.repository.js';
import { ConfigValueType } from './admin.types.js';

function configService(req: Request): AdminConfigService | null {
  const custom = req.app.locals.adminConfigService as AdminConfigService | undefined;
  if (custom) return custom;
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  return db ? new AdminConfigService(new PostgresAdminConfigRepository(db)) : null;
}

function storeUnavailable(res: Response) {
  return res.status(503).json({ ok: false, error: { code: 'ADMIN_CONFIG_STORE_UNAVAILABLE', message: 'Admin configuration requires the PostgreSQL database to be configured.' } });
}

export async function listAdminConfig(req: Request, res: Response) {
  const service = configService(req);
  if (!service) return storeUnavailable(res);
  try {
    return res.json({ ok: true, data: await service.list() });
  } catch {
    return res.status(500).json({ ok: false, error: { code: 'ADMIN_CONFIG_READ_FAILED' } });
  }
}

export async function updateAdminConfig(req: Request, res: Response) {
  const key = typeof req.body?.key === 'string' ? req.body.key : '';
  const valueType = req.body?.valueType as ConfigValueType;
  const actor = (req.auth as { userId?: string } | undefined)?.userId;
  if (!actor || !key || !['boolean','string','number','json'].includes(valueType)) {
    return res.status(400).json({ ok: false, error: { code: 'INVALID_ADMIN_CONFIG', message: 'key, valueType and authenticated admin actor are required' } });
  }
  const service = configService(req);
  if (!service) return storeUnavailable(res);
  try {
    const result = await service.set({ key, value: req.body.value, valueType, updatedBy: actor });
    return res.json({ ok: true, data: result });
  } catch (e) {
    // AdminConfigService rejects unsupported keys, wrong value types and sensitive values.
    const message = e instanceof Error ? e.message : 'Admin configuration update failed';
    const isValidation = /Unsupported|Expected|Invalid|Sensitive|required/.test(message);
    return res.status(isValidation ? 400 : 500).json({ ok: false, error: { code: isValidation ? 'INVALID_ADMIN_CONFIG' : 'ADMIN_CONFIG_WRITE_FAILED', message } });
  }
}
