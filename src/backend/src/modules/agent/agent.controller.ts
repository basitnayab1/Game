import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import { applyAsAgent, getAgentDashboard } from './agent.service.js';

function uid(req: Request) { return (req.auth as { userId?: string } | undefined)?.userId; }
function db(req: Request) { return (req.app.locals as { db?: DatabaseClient }).db; }

export async function getAgent(req: Request, res: Response) {
  const u = uid(req), d = db(req);
  if (!u) return res.status(401).json({ ok: false, error: { code: 'AUTHENTICATION_REQUIRED' } });
  if (!d) {
    return res.json({
      ok: true,
      data: {
        status: 'active',
        commissionRate: 0.05,
        totalDownline: 0,
        pendingCommissionsMinor: 0,
        totalPaidMinor: 0,
      },
    });
  }
  try { return res.json({ ok: true, data: await getAgentDashboard(d, u) }); } catch (e) { return res.status(500).json({ ok: false, error: { code: e instanceof Error ? e.message : 'AGENT_READ_FAILED' } }); }
}

export async function applyAgent(req: Request, res: Response) {
  const u = uid(req), d = db(req);
  if (!u) return res.status(401).json({ ok: false, error: { code: 'AUTHENTICATION_REQUIRED' } });
  if (!d) {
    return res.status(201).json({
      ok: true,
      data: {
        status: 'approved',
        message: 'Agent application received and approved.',
      },
    });
  }
  try { return res.status(201).json({ ok: true, data: await applyAsAgent(d, u, typeof req.body?.note === 'string' ? req.body.note : undefined) }); } catch (e) { return res.status(500).json({ ok: false, error: { code: e instanceof Error ? e.message : 'AGENT_APPLICATION_FAILED' } }); }
}
