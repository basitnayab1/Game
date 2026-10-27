import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import { listNotifications, markNotificationRead, markAllNotificationsRead, createSupportTicket, listSupportTickets, getSupportTicket, addSupportMessage } from './service.js';

const devNotifications: any[] = [
  { id: 'notif-1', title: 'Welcome to N5 Game', body: 'Claim your daily wheel spin and welcome deposit bonus!', is_read: false, created_at: new Date().toISOString() },
  { id: 'notif-2', title: 'VIP Program Active', body: 'Earn cashback and salary as you climb VIP tiers.', is_read: false, created_at: new Date().toISOString() },
];

const devTickets: any[] = [
  { id: 'ticket-001', category: 'financial', status: 'open', subject: 'Deposit inquiry', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), messages: [{ id: 'm1', sender_type: 'user', message: 'Hello, I made a deposit.', created_at: new Date().toISOString() }] },
];

function ready(req: Request, res: Response) {
  const userId = (req.auth as { userId?: string } | undefined)?.userId;
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  if (!userId) {
    res.status(401).json({ ok: false, error: { code: 'AUTHENTICATION_REQUIRED' } });
    return null;
  }
  return { userId, db };
}

export async function getNotifications(req: Request, res: Response) {
  const x = ready(req, res);
  if (!x) return;
  if (!x.db) return res.json({ ok: true, data: devNotifications });
  try { return res.json({ ok: true, data: await listNotifications(x.db, x.userId) }); } catch { return res.status(500).json({ ok: false, error: { code: 'NOTIFICATIONS_READ_FAILED' } }); }
}

export async function readNotification(req: Request, res: Response) {
  const x = ready(req, res);
  if (!x) return;
  if (!x.db) {
    const notif = devNotifications.find((n) => n.id === req.params.id);
    if (notif) notif.is_read = true;
    return res.json({ ok: true, data: { success: true } });
  }
  try { return res.json({ ok: true, data: await markNotificationRead(x.db, x.userId, String(req.params.id)) }); } catch (e) { return res.status(e instanceof Error && e.message === 'NOTIFICATION_NOT_FOUND' ? 404 : 500).json({ ok: false, error: { code: e instanceof Error ? e.message : 'NOTIFICATION_READ_FAILED' } }); }
}

export async function readAllNotifications(req: Request, res: Response) {
  const x = ready(req, res);
  if (!x) return;
  if (!x.db) {
    devNotifications.forEach((n) => { n.is_read = true; });
    return res.json({ ok: true, data: { success: true } });
  }
  try { return res.json({ ok: true, data: await markAllNotificationsRead(x.db, x.userId) }); } catch { return res.status(500).json({ ok: false, error: { code: 'NOTIFICATIONS_READ_ALL_FAILED' } }); }
}

export async function getTickets(req: Request, res: Response) {
  const x = ready(req, res);
  if (!x) return;
  if (!x.db) return res.json({ ok: true, data: devTickets });
  try { return res.json({ ok: true, data: await listSupportTickets(x.db, x.userId) }); } catch { return res.status(500).json({ ok: false, error: { code: 'SUPPORT_TICKETS_READ_FAILED' } }); }
}

export async function getTicket(req: Request, res: Response) {
  const x = ready(req, res);
  if (!x) return;
  if (!x.db) {
    const t = devTickets.find((tick) => tick.id === req.params.id) || devTickets[0];
    return res.json({ ok: true, data: t });
  }
  try { return res.json({ ok: true, data: await getSupportTicket(x.db, x.userId, String(req.params.id)) }); } catch (e) { return res.status(e instanceof Error && e.message === 'SUPPORT_TICKET_NOT_FOUND' ? 404 : 500).json({ ok: false, error: { code: e instanceof Error ? e.message : 'SUPPORT_TICKET_READ_FAILED' } }); }
}

export async function createTicket(req: Request, res: Response) {
  const x = ready(req, res);
  if (!x) return;
  if (!x.db) {
    const newT = {
      id: `ticket-${Date.now()}`,
      category: String(req.body?.category ?? 'general'),
      status: 'open',
      subject: String(req.body?.subject ?? 'Support inquiry'),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [{ id: `m-${Date.now()}`, sender_type: 'user', message: String(req.body?.message ?? ''), created_at: new Date().toISOString() }],
    };
    devTickets.push(newT);
    return res.status(201).json({ ok: true, data: newT });
  }
  try { return res.status(201).json({ ok: true, data: await createSupportTicket(x.db, x.userId, String(req.body?.category ?? ''), String(req.body?.subject ?? ''), String(req.body?.message ?? '')) }); } catch (e) { return res.status(400).json({ ok: false, error: { code: e instanceof Error ? e.message : 'SUPPORT_TICKET_CREATE_FAILED' } }); }
}

export async function postTicketMessage(req: Request, res: Response) {
  const x = ready(req, res);
  if (!x) return;
  if (!x.db) {
    const msg = { id: `m-${Date.now()}`, sender_type: 'user', message: String(req.body?.message ?? ''), created_at: new Date().toISOString() };
    const t = devTickets.find((tick) => tick.id === req.params.id);
    if (t) t.messages.push(msg);
    return res.status(201).json({ ok: true, data: msg });
  }
  try { return res.status(201).json({ ok: true, data: await addSupportMessage(x.db, x.userId, String(req.params.id), String(req.body?.message ?? '')) }); } catch (e) { const code = e instanceof Error ? e.message : 'SUPPORT_MESSAGE_FAILED'; return res.status(code === 'SUPPORT_TICKET_NOT_FOUND' ? 404 : code === 'SUPPORT_TICKET_CLOSED' ? 409 : 400).json({ ok: false, error: { code } }); }
}
