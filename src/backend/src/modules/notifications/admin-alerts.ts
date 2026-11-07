import type { DatabaseClient } from '../../core/database/database.types.js';

/**
 * Email alerts to the operator through Resend (https://resend.com).
 *
 *   RESEND_API_KEY       Resend key (server .env only)
 *   ADMIN_ALERT_EMAIL    who receives alerts; several separated by commas
 *   ALERT_FROM_EMAIL     sender, default "N5 Alerts <no-reply@n5gamez.com>"
 *   LARGE_WITHDRAWAL_RS  withdrawals at or above this are marked LARGE (default 50000)
 *
 * Alerts are sent in the background: a slow or failing email never delays
 * or breaks the player's request. Without the key or a recipient nothing is sent.
 */

const RESEND_URL = 'https://api.resend.com/emails';

function recipients(): string[] {
  return String(process.env.ADMIN_ALERT_EMAIL || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
}

export function adminAlertsEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY) && recipients().length > 0;
}

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Sends one alert; resolves to true when Resend accepted it. Never throws. */
export async function sendAdminAlert(subject: string, rows: Array<[string, unknown]>, note?: string): Promise<boolean> {
  if (!adminAlertsEnabled()) return false;
  const time = new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });
  const all: Array<[string, unknown]> = [...rows, ['Time', `${time} (PKT)`]];
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px">
      <h2 style="margin:0 0 12px;font-size:18px;color:#111">${esc(subject)}</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        ${all.map(([k, v]) => `<tr><td style="padding:6px 10px;color:#666;border-bottom:1px solid #eee;white-space:nowrap">${esc(k)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;font-weight:600">${esc(v)}</td></tr>`).join('')}
      </table>
      ${note ? `<p style="font-size:13px;color:#444;margin-top:14px">${esc(note)}</p>` : ''}
      <p style="font-size:12px;color:#999;margin-top:18px">N5 Game admin: <a href="https://admin.n5gamez.com/admin">admin.n5gamez.com</a></p>
    </div>`;
  const text = `${subject}\n\n${all.map(([k, v]) => `${k}: ${v}`).join('\n')}${note ? `\n\n${note}` : ''}\n\nhttps://admin.n5gamez.com/admin`;

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.ALERT_FROM_EMAIL || 'N5 Alerts <no-reply@n5gamez.com>',
        to: recipients(),
        subject: `[N5] ${subject}`,
        html,
        text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error('[ADMIN_ALERT] Resend refused:', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[ADMIN_ALERT] send failed:', (err as Error).message);
    return false;
  }
}

/** Fire-and-forget version for request handlers. */
export function alertInBackground(subject: string, rows: Array<[string, unknown]>, note?: string): void {
  if (!adminAlertsEnabled()) return;
  void sendAdminAlert(subject, rows, note);
}

const rs = (minor: number) => `Rs ${(minor / 100).toLocaleString('en-US')}`;

async function playerLabel(db: DatabaseClient, userId: string): Promise<string> {
  try {
    const r = (await db.query<{ phone_e164: string | null; display_name: string | null }>(
      `SELECT u.phone_e164, p.display_name FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = $1`,
      [userId],
    )).rows[0];
    if (!r) return userId;
    return r.display_name ? `${r.display_name} (${r.phone_e164})` : String(r.phone_e164 ?? userId);
  } catch {
    return userId;
  }
}

export function alertDepositRequested(db: DatabaseClient, userId: string, amountMinor: number, gateway: string, trxId: string | null): void {
  if (!adminAlertsEnabled()) return;
  void (async () => {
    await sendAdminAlert(`New deposit request: ${rs(amountMinor)}`, [
      ['Player', await playerLabel(db, userId)],
      ['Amount', rs(amountMinor)],
      ['Method', gateway],
      ['TRX ID', trxId || '-'],
    ], 'Check the payment in your wallet, then approve or reject it in Deposits.');
  })();
}

export function alertWithdrawalRequested(db: DatabaseClient, userId: string, amountMinor: number, netMinor: number, gateway: string, accountPhone: string, accountTitle: string | null): void {
  if (!adminAlertsEnabled()) return;
  const largeRs = Number(process.env.LARGE_WITHDRAWAL_RS || 50_000);
  const large = amountMinor >= largeRs * 100;
  void (async () => {
    await sendAdminAlert(`${large ? 'LARGE ' : ''}Withdrawal request: ${rs(amountMinor)}`, [
      ['Player', await playerLabel(db, userId)],
      ['Amount', rs(amountMinor)],
      ['To pay (after fee)', rs(netMinor)],
      ['Method', gateway],
      ['Account', `${accountPhone}${accountTitle ? ` (${accountTitle})` : ''}`],
    ], large ? `This is at or above Rs ${largeRs.toLocaleString('en-US')}. Review the player before paying.` : undefined);
  })();
}

export function alertAdminEvent(db: DatabaseClient, adminUserId: string, subject: string, rows: Array<[string, unknown]> = []): void {
  if (!adminAlertsEnabled()) return;
  void (async () => {
    await sendAdminAlert(subject, [['Admin', await playerLabel(db, adminUserId)], ...rows]);
  })();
}
