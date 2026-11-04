import { checkPlayAllowed } from '../responsibleGaming/enforcement.js';
import { notifyUser, rupees } from '../notifications/notify.js';
import type { DatabaseClient } from '../../core/database/database.types.js';

export async function getVipSummary(db: DatabaseClient, userId: string) {
  const r = await db.query(`
    SELECT COALESCE(uv.level,1) AS level, vl.name, vl.tier,
           COALESCE(uv.progress_minor,0) AS "progressMinor",
           vl.progress_target_minor AS "progressTargetMinor",
           CASE WHEN vl.progress_target_minor IS NULL OR vl.progress_target_minor <= 0 THEN 0
                ELSE LEAST(1, COALESCE(uv.progress_minor,0)::numeric / vl.progress_target_minor) END AS progress,
           CASE WHEN vl.level < 20 THEN vl.level + 1 ELSE NULL END AS "nextLevel"
    FROM vip_levels vl
    LEFT JOIN user_vip uv ON uv.user_id=$1 AND uv.level=vl.level
    WHERE vl.level=COALESCE((SELECT level FROM user_vip WHERE user_id=$1),1)
      AND vl.active=true`, [userId]);
  if (!r.rows[0]) throw new Error('VIP_NOT_CONFIGURED');
  return r.rows[0];
}

export async function listVipLevels(db: DatabaseClient) {
  const r = await db.query(`SELECT level,name,tier,progress_target_minor AS "progressTargetMinor",
    daily_salary_minor AS "dailySalaryMinor", monthly_salary_minor AS "monthlySalaryMinor",
    next_level_bonus_minor AS "nextLevelBonusMinor", benefits,active
    FROM vip_levels WHERE active=true ORDER BY level`);
  return r.rows;
}

export async function getVipLevel(db: DatabaseClient, level: number) {
  const r = await db.query(`SELECT level,name,tier,progress_target_minor AS "progressTargetMinor",
    daily_salary_minor AS "dailySalaryMinor", monthly_salary_minor AS "monthlySalaryMinor",
    next_level_bonus_minor AS "nextLevelBonusMinor", benefits,active
    FROM vip_levels WHERE level=$1 AND active=true`, [level]);
  if (!r.rows[0]) throw new Error('VIP_LEVEL_NOT_FOUND');
  return r.rows[0];
}

export async function listVipRewardHistory(db: DatabaseClient, userId: string) {
  const r = await db.query(`SELECT h.id,h.vip_level AS "vipLevel",v.name,v.tier,h.status,
    h.reward_event_id AS "rewardEventId",h.created_at AS "createdAt",h.claimed_at AS "claimedAt"
    FROM vip_reward_history h JOIN vip_levels v ON v.level=h.vip_level
    WHERE h.user_id=$1 ORDER BY h.created_at DESC LIMIT 50`, [userId]);
  return r.rows;
}

// ---------------------------------------------------------------------------
// Level progress, level-up bonuses and daily salary.
// A level is reached when the player's lifetime completed deposits and lifetime
// bets both meet that level's requirements (set per level in the admin panel).
// A level above 1 with neither requirement set is not reachable yet.
// ---------------------------------------------------------------------------

const TODAY_PK = `(now() AT TIME ZONE 'Asia/Karachi')::date`;

export async function vipTotals(db: DatabaseClient, userId: string) {
  const r = await db.query<{ deposited: string; bet: string }>(`
    SELECT
      (SELECT COALESCE(SUM(amount_minor),0) FROM transactions
        WHERE user_id=$1 AND type='deposit' AND status='completed')::text AS deposited,
      (SELECT COALESCE(SUM(l.amount_minor),0) FROM ledger_entries l
         JOIN wallet_accounts w ON w.id=l.wallet_account_id
        WHERE w.user_id=$1 AND l.entry_type='game_bet')::text AS bet`, [userId]);
  return { depositedMinor: BigInt(r.rows[0].deposited), betMinor: BigInt(r.rows[0].bet) };
}

async function creditWallet(tx: DatabaseClient, userId: string, amountMinor: bigint, entryType: string, idempotencyKey: string, metadata: object) {
  const w = (await tx.query<{ id: string }>(
    `SELECT id FROM wallet_accounts WHERE user_id=$1 AND currency='PKR' FOR UPDATE`, [userId])).rows[0];
  if (!w) throw new Error('WALLET_NOT_FOUND');
  await tx.query(`UPDATE wallet_accounts SET available_minor=available_minor+$1, version=version+1, updated_at=now() WHERE id=$2`,
    [amountMinor.toString(), w.id]);
  await tx.query(
    `INSERT INTO ledger_entries (wallet_account_id, entry_type, direction, amount_minor, currency, reference_type, idempotency_key, metadata)
     VALUES ($1,$2,'credit',$3,'PKR','vip',$4,$5::jsonb)`,
    [w.id, entryType, amountMinor.toString(), idempotencyKey, JSON.stringify(metadata)]);
}

/**
 * Moves the player up to the highest level they now qualify for, paying each
 * newly reached level's bonus once. Levels never go down. Returns the level.
 */
export async function syncVipLevel(db: DatabaseClient, userId: string): Promise<number> {
  return db.transaction(async (tx) => {
    // The wallet lock serialises syncs for this player, so a bonus is never paid twice.
    await tx.query(`SELECT id FROM wallet_accounts WHERE user_id=$1 AND currency='PKR' FOR UPDATE`, [userId]);
    await tx.query(`INSERT INTO user_vip (user_id, level) VALUES ($1, 1) ON CONFLICT (user_id) DO NOTHING`, [userId]);
    const current = Number((await tx.query<{ level: number }>(`SELECT level FROM user_vip WHERE user_id=$1`, [userId])).rows[0].level);
    const { depositedMinor, betMinor } = await vipTotals(tx, userId);
    const reachable = (await tx.query<{ level: number; bonus: string | null }>(`
      SELECT level, next_level_bonus_minor::text AS bonus FROM vip_levels
       WHERE active AND level > $1
         AND (deposit_required_minor IS NOT NULL OR betting_required_minor IS NOT NULL)
         AND COALESCE(deposit_required_minor,0) <= $2 AND COALESCE(betting_required_minor,0) <= $3
       ORDER BY level`, [current, depositedMinor.toString(), betMinor.toString()])).rows;
    if (reachable.length === 0) return current;

    const paused = await checkPlayAllowed(tx, userId);
    for (const l of reachable) {
      const bonus = l.bonus ? BigInt(l.bonus) : 0n;
      const fresh = (await tx.query(
        `INSERT INTO vip_reward_history (user_id, vip_level, status, claimed_at) VALUES ($1,$2,'claimed',now())
         ON CONFLICT (user_id, vip_level) DO NOTHING RETURNING id`, [userId, l.level])).rows.length > 0;
      // No money while the player is on a break or self-excluded; the level still counts.
      if (fresh && bonus > 0n && !paused) {
        await creditWallet(tx, userId, bonus, 'vip_level_bonus', `vip_level_bonus:${userId}:${l.level}`, { level: l.level });
      }
    }
    const top = reachable[reachable.length - 1];
    await tx.query(`UPDATE user_vip SET level=$2, qualified_at=now(), updated_at=now() WHERE user_id=$1`, [userId, top.level]);
    const totalBonus = reachable.reduce((sum, l) => sum + (l.bonus ? BigInt(l.bonus) : 0n), 0n);
    await notifyUser(tx, userId, 'PROMOTION', `VIP ${top.level} reached!`,
      paused || totalBonus === 0n
        ? `Congratulations, you are now VIP ${top.level}.`
        : `Congratulations, you are now VIP ${top.level}. Rs ${rupees(totalBonus)} level bonus has been added to your wallet.`);
    return Number(top.level);
  });
}

/** Pays today's salary for the player's current level, once per day. */
export async function claimVipSalary(db: DatabaseClient, userId: string) {
  await syncVipLevel(db, userId);
  return db.transaction(async (tx) => {
    await tx.query(`SELECT id FROM wallet_accounts WHERE user_id=$1 AND currency='PKR' FOR UPDATE`, [userId]);
    const paused = await checkPlayAllowed(tx, userId);
    if (paused) throw paused;
    const lvl = (await tx.query<{ level: number; salary: string | null }>(`
      SELECT uv.level, vl.daily_salary_minor::text AS salary FROM user_vip uv JOIN vip_levels vl ON vl.level=uv.level
       WHERE uv.user_id=$1`, [userId])).rows[0];
    const salary = lvl?.salary ? BigInt(lvl.salary) : 0n;
    if (salary <= 0n) throw { statusCode: 400, code: 'NO_SALARY_FOR_LEVEL', message: 'Your VIP level has no daily salary yet.' };
    const claimed = (await tx.query(
      `INSERT INTO vip_salary_claims (user_id, claim_date, vip_level, amount_minor) VALUES ($1, ${TODAY_PK}, $2, $3)
       ON CONFLICT (user_id, claim_date) DO NOTHING RETURNING id`, [userId, lvl.level, salary.toString()])).rows.length > 0;
    if (!claimed) throw { statusCode: 429, code: 'SALARY_ALREADY_CLAIMED', message: 'Today\'s salary is already claimed. Come back tomorrow.' };
    await creditWallet(tx, userId, salary, 'vip_salary', `vip_salary:${userId}:${new Date().toISOString().slice(0, 10)}:${lvl.level}`, { level: lvl.level });
    return { level: Number(lvl.level), amountMinor: Number(salary) };
  });
}

/** Everything the VIP screen needs, after bringing the level up to date. */
export async function getVipOverview(db: DatabaseClient, userId: string) {
  const level = await syncVipLevel(db, userId);
  const { depositedMinor, betMinor } = await vipTotals(db, userId);
  const cur = (await db.query<any>(`SELECT level, name, tier, daily_salary_minor AS "dailySalaryMinor" FROM vip_levels WHERE level=$1`, [level])).rows[0];
  const next = (await db.query<any>(`
    SELECT level, name, deposit_required_minor AS "depositRequiredMinor", betting_required_minor AS "bettingRequiredMinor",
           next_level_bonus_minor AS "levelBonusMinor", daily_salary_minor AS "dailySalaryMinor"
      FROM vip_levels WHERE active AND level > $1
       AND (deposit_required_minor IS NOT NULL OR betting_required_minor IS NOT NULL)
     ORDER BY level LIMIT 1`, [level])).rows[0] ?? null;
  const claimedToday = (await db.query(`SELECT 1 FROM vip_salary_claims WHERE user_id=$1 AND claim_date=${TODAY_PK}`, [userId])).rows.length > 0;
  return {
    level, name: cur?.name, tier: cur?.tier,
    dailySalaryMinor: cur?.dailySalaryMinor == null ? 0 : Number(cur.dailySalaryMinor),
    salaryClaimedToday: claimedToday,
    depositedMinor: Number(depositedMinor), betMinor: Number(betMinor),
    next: next && {
      level: next.level, name: next.name,
      depositRequiredMinor: Number(next.depositRequiredMinor ?? 0),
      bettingRequiredMinor: Number(next.bettingRequiredMinor ?? 0),
      levelBonusMinor: Number(next.levelBonusMinor ?? 0),
      dailySalaryMinor: Number(next.dailySalaryMinor ?? 0),
    },
  };
}
