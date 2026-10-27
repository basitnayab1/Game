import type { DatabaseClient } from '../..//core/database/database.types.js';

export interface ReferralSummary { code:string; total:number; pending:number; qualified:number; rewarded:number; }
export interface ReferralItem { id:string; invitedUserId:string; status:string; rewardMinor:string|null; createdAt:string; }
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
  const c:any=await db.query(`SELECT (SELECT code FROM referral_codes WHERE user_id=$1 AND status='active' ORDER BY created_at ASC LIMIT 1) AS code,
    COUNT(r.id)::int AS total, COUNT(*) FILTER (WHERE r.status='pending')::int AS pending,
    COUNT(*) FILTER (WHERE r.status='qualified')::int AS qualified, COUNT(*) FILTER (WHERE r.status='rewarded')::int AS rewarded
    FROM referrals r WHERE r.inviter_user_id=$1`,[userId]);
  const x=c.rows[0]; return {code:x.code??'',total:Number(x.total),pending:Number(x.pending),qualified:Number(x.qualified),rewarded:Number(x.rewarded)};
}
export async function listReferralHistory(db:DatabaseClient,userId:string):Promise<ReferralItem[]>{
 const r:any=await db.query(`SELECT id, invited_user_id, status, reward_minor, created_at FROM referrals WHERE inviter_user_id=$1 ORDER BY created_at DESC LIMIT 100`,[userId]);
 return r.rows.map((x:any)=>({id:x.id,invitedUserId:x.invited_user_id,status:x.status,rewardMinor:x.reward_minor==null?null:String(x.reward_minor),createdAt:x.created_at}));
}
export async function ensureReferralCode(db:DatabaseClient,userId:string){
 const existing:any=await db.query(`SELECT code FROM referral_codes WHERE user_id=$1 AND status='active' LIMIT 1`,[userId]); if(existing.rows[0]) return existing.rows[0].code;
 const code=`N5${userId.replace(/-/g,'').slice(0,8).toUpperCase()}`; await db.query(`INSERT INTO referral_codes(user_id,code) VALUES($1,$2) ON CONFLICT(code) DO NOTHING`,[userId,code]);
 const r:any=await db.query(`SELECT code FROM referral_codes WHERE user_id=$1 AND status='active' LIMIT 1`,[userId]); return r.rows[0]?.code??code;
}
