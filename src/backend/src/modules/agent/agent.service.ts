import type { DatabaseClient } from '../../core/database/database.types.js';
export async function getAgentDashboard(db:DatabaseClient,userId:string){
 const a:any=await db.query(`SELECT id,status,approved_at FROM agent_accounts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,[userId]);
 const agent=a.rows[0]??null;if(!agent)return {status:'not_applied',agentId:null,directUsers:0,networkUsers:0,qualifiedUsers:0,commission:{pending:'0',approved:'0',paid:'0',reversed:'0'}};
 const c:any=await db.query(`SELECT status,COUNT(*)::int count FROM agent_commissions WHERE agent_id=$1 GROUP BY status`,[agent.id]); const counts:any={pending:'0',approved:'0',paid:'0',reversed:'0'}; for(const r of c.rows) counts[r.status]=String(r.count);
 const d:any=await db.query(`SELECT COUNT(*)::int count FROM referrals WHERE inviter_user_id=$1`,[userId]);
 return {status:agent.status,agentId:agent.id,directUsers:Number(d.rows[0]?.count??0),networkUsers:Number(d.rows[0]?.count??0),qualifiedUsers:0,commission:counts};
}
export async function applyAsAgent(db:DatabaseClient,userId:string,note?:string){
 const r:any=await db.query(`INSERT INTO agent_accounts(user_id,status,application_note) VALUES($1,'pending',$2) ON CONFLICT DO NOTHING RETURNING id,status`,[userId,note??null]);
 if(r.rows[0]) return r.rows[0]; const e:any=await db.query(`SELECT id,status FROM agent_accounts WHERE user_id=$1 ORDER BY created_at DESC LIMIT 1`,[userId]); return e.rows[0];
}
