import type { DatabaseClient } from '../../core/database/database.types.js';

export type NotificationCategory = 'TRANSACTION'|'PROMOTION'|'SECURITY'|'SYSTEM';
const ticketStatuses = ['open','in_progress','waiting_for_user','resolved','closed','reopened'] as const;

export async function listNotifications(db: DatabaseClient, userId: string) {
  const r = await db.query(`SELECT id,category,title,body,read_at,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`, [userId]);
  return r.rows;
}
export async function markNotificationRead(db: DatabaseClient, userId: string, id: string) {
  const r = await db.query(`UPDATE notifications SET read_at=COALESCE(read_at,now()) WHERE id=$1 AND user_id=$2 RETURNING id,read_at`, [id,userId]);
  if (!r.rows[0]) throw new Error('NOTIFICATION_NOT_FOUND');
  return r.rows[0];
}
export async function markAllNotificationsRead(db: DatabaseClient, userId: string) {
  const r = await db.query(`UPDATE notifications SET read_at=now() WHERE user_id=$1 AND read_at IS NULL`, [userId]);
  return {markedRead:r.rows.length};
}

export async function createSupportTicket(db: DatabaseClient, userId: string, category: string, subject: string, message: string) {
  if (!category.trim() || !subject.trim() || !message.trim()) throw new Error('SUPPORT_FIELDS_REQUIRED');
  return db.transaction(async tx => {
    const t = await tx.query<{id:string;status:string;created_at:string}>(
      `INSERT INTO support_tickets(user_id,category,status,subject) VALUES($1,$2,'open',$3) RETURNING id,status,created_at`,
      [userId, category.trim(), subject.trim().slice(0,180)]);
    const ticket = t.rows[0];
    await tx.query(`INSERT INTO support_messages(ticket_id,sender_user_id,message) VALUES($1,$2,$3)`, [ticket.id,userId,message.trim()]);
    return ticket;
  });
}
export async function listSupportTickets(db: DatabaseClient, userId: string) {
  const r = await db.query(`SELECT id,category,status,subject,created_at,updated_at FROM support_tickets WHERE user_id=$1 ORDER BY updated_at DESC LIMIT 100`, [userId]);
  return r.rows;
}
export async function getSupportTicket(db: DatabaseClient, userId: string, ticketId: string) {
  const t = await db.query(`SELECT id,category,status,subject,created_at,updated_at FROM support_tickets WHERE id=$1 AND user_id=$2`, [ticketId,userId]);
  if (!t.rows[0]) throw new Error('SUPPORT_TICKET_NOT_FOUND');
  const m = await db.query(`SELECT id,sender_user_id,message,created_at FROM support_messages WHERE ticket_id=$1 ORDER BY created_at ASC`, [ticketId]);
  return {ticket:t.rows[0],messages:m.rows};
}
export async function addSupportMessage(db: DatabaseClient, userId: string, ticketId: string, message: string) {
  if (!message.trim()) throw new Error('SUPPORT_MESSAGE_REQUIRED');
  return db.transaction(async tx => {
    const t = await tx.query<{id:string;status:string}>(`SELECT id,status FROM support_tickets WHERE id=$1 AND user_id=$2 FOR UPDATE`, [ticketId,userId]);
    if (!t.rows[0]) throw new Error('SUPPORT_TICKET_NOT_FOUND');
    if (t.rows[0].status === 'closed') throw new Error('SUPPORT_TICKET_CLOSED');
    await tx.query(`INSERT INTO support_messages(ticket_id,sender_user_id,message) VALUES($1,$2,$3)`, [ticketId,userId,message.trim()]);
    await tx.query(`UPDATE support_tickets SET status=CASE WHEN status='waiting_for_user' THEN 'open' ELSE status END,updated_at=now() WHERE id=$1`, [ticketId]);
    return {ticketId,messageAdded:true};
  });
}

export function isTicketStatus(value: string): boolean { return (ticketStatuses as readonly string[]).includes(value); }
