import { settleInviterReferrals } from './referral-rewards.js';
import type { DatabaseClient } from '../..//core/database/database.types.js';

export interface ReferralSummary { code:string; total:number; pending:number; qualified:number; rewarded:number; earnedMinor?:number; }
export interface ReferralItem { id:string; invitedUserId:string; status:string; rewardMinor:string|null; createdAt:string;
  phone:string; depositedMinor:number; depositedTodayMinor:number; betMinor:number; earnedMinor:number; }
export interface ReferralQualificationDecision {
  status: 'pending' | 'qualified' | 'rewarded' | 'rejected';
  reason: string;
}

/** Server-side qualification boundary. The client never decides referral eligibility. */
export function qualificationDecision(status: string): ReferralQualificationDecision {
  if (status === 'qualified') return { status: 'qualified', reason: 'server_qualification_passed' };
  if (status === 'rewarded') return { status: 'rewarded', reason: 'server_reward_recorded' };
  if (status === 'rejected') return { status: 'rejected', reason: 'server_risk_or_eligibility_rejected' };
  return { status: 'pending', reason: 'server_qualification_pending' };
}

export async function getReferralSummary(db:DatabaseClient,userId:string):Promise<ReferralSummary>{
  await settleInviterReferrals(db,userId);
  const c:any=await db.query(`SELECT (SELECT code FROM referral_codes WHERE user_id=$1 AND status='active' ORDER BY created_at ASC LIMIT 1) AS code,
    (SELECT COALESCE(SUM(amount_minor),0) FROM referral_earnings WHERE inviter_user_id=$1)::text AS earned,
    COUNT(r.id)::int AS total, COUNT(*) FILTER (WHERE r.status='pending')::int AS pending,
    COUNT(*) FILTER (WHERE r.status='qualified')::int AS qualified, COUNT(*) FILTER (WHERE r.status='rewarded')::int AS rewarded
    FROM referrals r WHERE r.inviter_user_id=$1`,[userId]);
  const x=c.rows[0]; return {code:x.code??'',total:Number(x.total),pending:Number(x.pending),qualified:Number(x.qualified),rewarded:Number(x.rewarded),earnedMinor:Number(x.earned)};
}
/**
 * The inviter's friends with their progress: deposits, betting, today's deposits
 * and what the inviter has earned from each. Phone numbers are partly hidden.
 */
export async function listReferralHistory(db:DatabaseClient,userId:string):Promise<ReferralItem[]>{
 await settleInviterReferrals(db,userId);
 const r:any=await db.query(`
   SELECT r.id, r.invited_user_id, r.status, r.reward_minor, r.created_at, u.phone_e164,
     (SELECT COALESCE(SUM(t.amount_minor),0) FROM transactions t WHERE t.user_id=r.invited_user_id AND t.type='deposit' AND t.status='completed')::text AS deposited,
     (SELECT COALESCE(SUM(t.amount_minor),0) FROM transactions t WHERE t.user_id=r.invited_user_id AND t.type='deposit' AND t.status='completed'
        AND t.created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Karachi') AT TIME ZONE 'Asia/Karachi')::text AS deposited_today,
     (SELECT COALESCE(SUM(l.amount_minor),0) FROM ledger_entries l JOIN wallet_accounts w ON w.id=l.wallet_account_id
        WHERE w.user_id=r.invited_user_id AND l.entry_type='game_bet')::text AS bet,
     (SELECT COALESCE(SUM(e.amount_minor),0) FROM referral_earnings e WHERE e.referral_id=r.id)::text AS earned
   FROM referrals r JOIN users u ON u.id=r.invited_user_id
  WHERE r.inviter_user_id=$1 ORDER BY r.created_at DESC LIMIT 100`,[userId]);
 return r.rows.map((x:any)=>({id:x.id,invitedUserId:x.invited_user_id,status:x.status,rewardMinor:x.reward_minor==null?null:String(x.reward_minor),createdAt:x.created_at,
   phone:maskPhone(x.phone_e164),depositedMinor:Number(x.deposited),depositedTodayMinor:Number(x.deposited_today),betMinor:Number(x.bet),earnedMinor:Number(x.earned)}));
}

/** +923001234567 -> +92300****567 */
function maskPhone(p:string){ return p && p.length > 8 ? `${p.slice(0, 6)}****${p.slice(-3)}` : p; }
export async function ensureReferralCode(db:DatabaseClient,userId:string){
 const existing:any=await db.query(`SELECT code FROM referral_codes WHERE user_id=$1 AND status='active' LIMIT 1`,[userId]); if(existing.rows[0]) return existing.rows[0].code;
 const code=`N5${userId.replace(/-/g,'').slice(0,8).toUpperCase()}`; await db.query(`INSERT INTO referral_codes(user_id,code) VALUES($1,$2) ON CONFLICT(code) DO NOTHING`,[userId,code]);
 const r:any=await db.query(`SELECT code FROM referral_codes WHERE user_id=$1 AND status='active' LIMIT 1`,[userId]); return r.rows[0]?.code??code;
}
