import { env } from '../config/env.js';
import { createDatabaseClient } from '../core/database/postgres.client.js';
import { normalizePhone } from '../modules/auth/service.js';

/**
 * Clears an admin's authenticator 2FA (lost phone). They set it up again on
 * their next admin login. Run on the server:
 *   docker exec n5-app node dist/scripts/reset-admin-2fa.js --phone=03001234567
 */
async function cli() {
  const arg = process.argv.slice(2).find((a) => a.startsWith('--phone='));
  const phone = arg ? normalizePhone(arg.slice('--phone='.length)) : '';
  const dbUrl = process.env.DATABASE_URL || env.DATABASE_URL;
  if (!phone || !dbUrl) {
    console.error('Usage: node dist/scripts/reset-admin-2fa.js --phone=03001234567  (DATABASE_URL must be set)');
    process.exit(1);
  }
  const db = createDatabaseClient(dbUrl);
  try {
    const r = await db.query<{ user_id: string }>(
      `UPDATE admin_users au SET totp_secret_enc = NULL, totp_enabled_at = NULL, totp_last_step = NULL,
              totp_failed_count = 0, totp_locked_until = NULL, updated_at = now()
         FROM users u WHERE u.id = au.user_id AND u.phone_e164 = $1
       RETURNING au.user_id`,
      [phone],
    );
    if (!r.rows[0]) {
      console.error(`No admin with phone ${phone}.`);
      process.exit(1);
    }
    await db.query(`UPDATE user_sessions SET admin_2fa_at = NULL WHERE user_id = $1`, [r.rows[0].user_id]);
    await db.query(
      `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, metadata) VALUES (NULL, 'admin.team.reset_2fa', 'admin_user', $1, '{"via":"server-script"}')`,
      [r.rows[0].user_id],
    );
    console.log(`2FA cleared for ${phone}. They will set it up again at the next admin login.`);
  } finally {
    await db.close().catch(() => {});
  }
}

cli().catch((err) => {
  console.error('[RESET 2FA FAILED]', (err as Error).message);
  process.exit(1);
});
