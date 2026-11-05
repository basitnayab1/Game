import type { DatabaseClient } from '../../core/database/database.types.js';
import { notifyUser, rupees } from '../notifications/notify.js';

/**
 * Referral rewards, paid to the inviter:
 *  - Rs 400 once the invited player has deposited at least Rs 600 and bet at
 *    least Rs 6,000 in total (completed deposits, real bets);
 *  - Rs 5 per Rs 1,000 (0.5%) of every completed deposit the invited player makes.
 */
export const REFERRAL_REWARD_MINOR = 400 * 100;
export const REFERRAL_DEPOSIT_REQUIRED_MINOR = 600 * 100;
export const REFERRAL_BETTING_REQUIRED_MINOR = 6000 * 100;
export const REFERRAL_DEPOSIT_COMMISSION_PER_MILLE = 5;

async function creditInviter(tx: DatabaseClient, inviterId: string, amountMinor: bigint, entryType: string, key: string, metadata: object) {
  const w = (await tx.query<{ id: string }>(
    `SELECT id FROM wallet_accounts WHERE user_id=$1 AND currency='PKR' FOR UPDATE`, [inviterId])).rows[0];
  if (!w) return false;
  await tx.query(`UPDATE wallet_accounts SET available_minor=available_minor+$1, version=version+1, updated_at=now() WHERE id=$2`,
    [amountMinor.toString(), w.id]);
  await tx.query(
    `INSERT INTO ledger_entries (wallet_account_id, entry_type, direction, amount_minor, currency, reference_type, idempotency_key, metadata)
     VALUES ($1,$2,'credit',$3,'PKR','referral',$4,$5::jsonb)`,
    [w.id, entryType, amountMinor.toString(), key, JSON.stringify(metadata)]);
  return true;
}

/**
 * Commission on a completed deposit. Call inside the transaction that completes
 * the deposit. Does nothing when the depositor was not invited.
 */
export async function payDepositCommission(tx: DatabaseClient, depositorId: string, transactionId: string, amountMinor: bigint) {
  const ref = (await tx.query<{ id: string; inviter_user_id: string }>(
    `SELECT id, inviter_user_id FROM referrals WHERE invited_user_id=$1 AND status <> 'rejected'`, [depositorId])).rows[0];
  if (!ref) return;
  const commission = (amountMinor * BigInt(REFERRAL_DEPOSIT_COMMISSION_PER_MILLE)) / 1000n;
  if (commission <= 0n) return;
  const fresh = (await tx.query(
    `INSERT INTO referral_earnings (referral_id, inviter_user_id, kind, source_transaction_id, amount_minor)
     VALUES ($1,$2,'deposit',$3,$4) ON CONFLICT DO NOTHING RETURNING id`,
    [ref.id, ref.inviter_user_id, transactionId, commission.toString()])).rows.length > 0;
  if (!fresh) return;
  if (await creditInviter(tx, ref.inviter_user_id, commission, 'referral_commission', `ref_commission:${transactionId}`,
    { invitedUserId: depositorId, transactionId })) {
    await notifyUser(tx, ref.inviter_user_id, 'PROMOTION', 'Referral commission',
      `Rs ${rupees(commission)} added: a friend you invited made a deposit.`);
  }
}

/**
 * Pays the one-time reward once the invited player qualifies. Safe to call any
 * number of times; it pays at most once.
 */
export async function settleReferralQualification(db: DatabaseClient, invitedUserId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const ref = (await tx.query<{ id: string; inviter_user_id: string }>(
      `SELECT id, inviter_user_id FROM referrals WHERE invited_user_id=$1 AND status='pending' FOR UPDATE`, [invitedUserId])).rows[0];
    if (!ref) return false;
    const t = (await tx.query<{ deposited: string; bet: string }>(`
      SELECT
        (SELECT COALESCE(SUM(amount_minor),0) FROM transactions
          WHERE user_id=$1 AND type='deposit' AND status='completed')::text AS deposited,
        (SELECT COALESCE(SUM(l.amount_minor),0) FROM ledger_entries l JOIN wallet_accounts w ON w.id=l.wallet_account_id
          WHERE w.user_id=$1 AND l.entry_type='game_bet')::text AS bet`, [invitedUserId])).rows[0];
    if (BigInt(t.deposited) < BigInt(REFERRAL_DEPOSIT_REQUIRED_MINOR) || BigInt(t.bet) < BigInt(REFERRAL_BETTING_REQUIRED_MINOR)) return false;

    await tx.query(
      `UPDATE referrals SET status='rewarded', reward_minor=$2, qualification_reason='deposit_and_betting_met',
              qualified_at=now(), rewarded_at=now() WHERE id=$1`,
      [ref.id, REFERRAL_REWARD_MINOR]);
    await tx.query(
      `INSERT INTO referral_earnings (referral_id, inviter_user_id, kind, amount_minor) VALUES ($1,$2,'qualification',$3)`,
      [ref.id, ref.inviter_user_id, REFERRAL_REWARD_MINOR]);
    if (await creditInviter(tx, ref.inviter_user_id, BigInt(REFERRAL_REWARD_MINOR), 'referral_reward', `ref_reward:${ref.id}`,
      { invitedUserId })) {
      await notifyUser(tx, ref.inviter_user_id, 'PROMOTION', 'Referral reward',
        `Rs ${rupees(REFERRAL_REWARD_MINOR)} added: a friend you invited completed their deposit and betting.`);
    }
    return true;
  });
}

/** Settles every pending referral of an inviter (when they open their referral page). */
export async function settleInviterReferrals(db: DatabaseClient, inviterId: string) {
  const pending = (await db.query<{ invited_user_id: string }>(
    `SELECT invited_user_id FROM referrals WHERE inviter_user_id=$1 AND status='pending'`, [inviterId])).rows;
  for (const p of pending) await settleReferralQualification(db, p.invited_user_id);
}
