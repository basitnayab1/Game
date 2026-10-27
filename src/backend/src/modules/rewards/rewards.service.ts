import type { DatabaseClient } from '../../core/database/database.types.js';

export async function listAvailablePromotions(db: DatabaseClient, userId: string, now = new Date()) {
  const r = await db.query(`SELECT p.id, p.title, p.promotion_type AS "promotionType", p.status,
    p.starts_at AS "startsAt", p.ends_at AS "endsAt", p.config,
    COALESCE(pc.status, 'available') AS "claimStatus", pc.claimed_at AS "claimedAt"
    FROM promotions p LEFT JOIN promotion_claims pc ON pc.promotion_id=p.id AND pc.user_id=$1
    WHERE p.status='active' AND p.starts_at <= $2 AND p.ends_at > $2
    ORDER BY p.ends_at ASC, p.created_at DESC`, [userId, now]);
  return r.rows;
}

export async function claimPromotion(db: DatabaseClient, userId: string, promotionId: string, now = new Date()) {
  return db.transaction(async tx => {
    const p = await tx.query<{id:string;endsAt:Date;status:string}>(
      `SELECT id, ends_at AS "endsAt", status FROM promotions WHERE id=$1 FOR UPDATE`, [promotionId]);
    if (!p.rows[0] || p.rows[0].status !== 'active' || new Date(p.rows[0].endsAt).getTime() <= now.getTime()) {
      throw new Error('PROMOTION_NOT_AVAILABLE');
    }
    const existing = await tx.query<{status:string}>(`SELECT status FROM promotion_claims WHERE promotion_id=$1 AND user_id=$2 FOR UPDATE`, [promotionId,userId]);
    if (existing.rows[0]?.status === 'claimed') throw new Error('PROMOTION_ALREADY_CLAIMED');
    if (existing.rows[0]?.status === 'available') return { status:'available', requiresOpen:true };
    await tx.query(`INSERT INTO promotion_claims(promotion_id,user_id,status,expires_at) VALUES($1,$2,'available',$3)
      ON CONFLICT (promotion_id,user_id) DO UPDATE SET status='available', expires_at=EXCLUDED.expires_at`, [promotionId,userId,p.rows[0].endsAt]);
    return { status:'available', requiresOpen:true };
  });
}

export async function openPromotionReward(db: DatabaseClient, userId: string, promotionId: string, now = new Date()) {
  return db.transaction(async tx => {
    const c = await tx.query<{id:string;status:string;expiresAt:Date|null}>(`SELECT id,status,expires_at AS "expiresAt" FROM promotion_claims WHERE promotion_id=$1 AND user_id=$2 FOR UPDATE`, [promotionId,userId]);
    if (!c.rows[0]) throw new Error('PROMOTION_CLAIM_NOT_FOUND');
    if (c.rows[0].status === 'claimed') return { status:'claimed', rewardRecorded:true };
    if (c.rows[0].expiresAt && new Date(c.rows[0].expiresAt).getTime() <= now.getTime()) throw new Error('PROMOTION_EXPIRED');
    await tx.query(`UPDATE promotion_claims SET status='claimed', opened_at=$1, claimed_at=$1 WHERE id=$2`, [now,c.rows[0].id]);
    const reward = await tx.query<{id:string}>(`INSERT INTO reward_events(user_id,reward_type,source_id,status,claimed_at) VALUES($1,'promotion',$2,'claimed',$3) RETURNING id`, [userId,promotionId,now]);
    return { status:'claimed', rewardRecorded:true, rewardEventId:reward.rows[0]?.id };
  });
}

export async function listRewardCycles(db: DatabaseClient, userId: string, now = new Date()) {
  await txExpire(db, userId, now);
  const r = await db.query(`SELECT id, cycle_type AS "cycleType", cycle_key AS "cycleKey", status,
    available_at AS "availableAt", expires_at AS "expiresAt", claimed_at AS "claimedAt", reward_event_id AS "rewardEventId"
    FROM reward_cycles WHERE user_id=$1 ORDER BY available_at DESC LIMIT 30`, [userId]);
  return r.rows;
}

async function txExpire(db: DatabaseClient, userId: string, now: Date) {
  await db.query(`UPDATE reward_cycles SET status='expired' WHERE user_id=$1 AND status='available' AND expires_at IS NOT NULL AND expires_at <= $2`, [userId,now]);
}

export async function openRewardCycle(db: DatabaseClient, userId: string, cycleId: string, now = new Date()) {
  return db.transaction(async tx => {
    const r = await tx.query<{id:string;status:string;expiresAt:Date|null;cycleType:string;cycleKey:string}>(`SELECT id,status,expires_at AS "expiresAt",cycle_type AS "cycleType",cycle_key AS "cycleKey" FROM reward_cycles WHERE id=$1 AND user_id=$2 FOR UPDATE`, [cycleId,userId]);
    if (!r.rows[0]) throw new Error('REWARD_NOT_FOUND');
    const x=r.rows[0];
    if (x.status==='claimed') return {status:'claimed'};
    if (x.status==='expired' || (x.expiresAt && new Date(x.expiresAt).getTime()<=now.getTime())) { await tx.query(`UPDATE reward_cycles SET status='expired' WHERE id=$1`,[cycleId]); throw new Error('REWARD_EXPIRED'); }
    const ev=await tx.query<{id:string}>(`INSERT INTO reward_events(user_id,reward_type,source_id,status,claimed_at,metadata) VALUES($1,$2,$3,'claimed',$4,$5) RETURNING id`,[userId,x.cycleType,cycleId,now,JSON.stringify({cycleKey:x.cycleKey})]);
    await tx.query(`UPDATE reward_cycles SET status='claimed', claimed_at=$1, reward_event_id=$2 WHERE id=$3`,[now,ev.rows[0].id,cycleId]);
    return {status:'claimed',rewardEventId:ev.rows[0].id};
  });
}
