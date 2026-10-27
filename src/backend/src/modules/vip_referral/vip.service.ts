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
