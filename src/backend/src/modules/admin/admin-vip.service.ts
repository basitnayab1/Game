import type { DatabaseClient } from '../../core/database/database.types.js';

const LEVELS = new Set(Array.from({length:20},(_,i)=>i+1));
function money(v: unknown){ if(v===null||v===undefined||v==='') return null; if(typeof v!=='number'||!Number.isInteger(v)||v<0||v>100000000000) throw new Error('INVALID_VIP_AMOUNT'); return v; }
function benefits(v: unknown){ if(!Array.isArray(v)) throw new Error('INVALID_VIP_BENEFITS'); if(v.some(x=>typeof x!=='string'||x.length>200)) throw new Error('INVALID_VIP_BENEFITS'); return v; }

export async function listAdminVipLevels(db:DatabaseClient){
 const r=await db.query(`SELECT level,name,tier,progress_target_minor AS "progressTargetMinor",daily_salary_minor AS "dailySalaryMinor",monthly_salary_minor AS "monthlySalaryMinor",next_level_bonus_minor AS "nextLevelBonusMinor",benefits,active,updated_at AS "updatedAt" FROM vip_levels ORDER BY level`);
 return r.rows;
}

export async function updateAdminVipLevel(db:DatabaseClient, actorId:string, level:number, input:any){
 if(!LEVELS.has(level)) throw new Error('INVALID_VIP_LEVEL');
 if(input?.name!==undefined && (typeof input.name!=='string'||!input.name.trim()||input.name.length>64)) throw new Error('INVALID_VIP_NAME');
 if(input?.tier!==undefined && (typeof input.tier!=='string'||!input.tier.trim()||input.tier.length>64)) throw new Error('INVALID_VIP_TIER');
 if(input?.active!==undefined && typeof input.active!=='boolean') throw new Error('INVALID_VIP_ACTIVE');
 const p=money(input?.progressTargetMinor), d=money(input?.dailySalaryMinor), m=money(input?.monthlySalaryMinor), b=money(input?.nextLevelBonusMinor);
 if(input?.benefits!==undefined) benefits(input.benefits);
 return db.transaction(async tx=>{
  const r=await tx.query(`UPDATE vip_levels SET name=COALESCE($2,name),tier=COALESCE($3,tier),progress_target_minor=COALESCE($4,progress_target_minor),daily_salary_minor=COALESCE($5,daily_salary_minor),monthly_salary_minor=COALESCE($6,monthly_salary_minor),next_level_bonus_minor=COALESCE($7,next_level_bonus_minor),benefits=COALESCE($8::jsonb,benefits),active=COALESCE($9,active),updated_at=now() WHERE level=$1 RETURNING level,name,tier,progress_target_minor AS "progressTargetMinor",daily_salary_minor AS "dailySalaryMinor",monthly_salary_minor AS "monthlySalaryMinor",next_level_bonus_minor AS "nextLevelBonusMinor",benefits,active,updated_at AS "updatedAt"`,[level,input.name?.trim()??null,input.tier?.trim()??null,p,d,m,b,input.benefits===undefined?null:JSON.stringify(input.benefits),input.active??null]);
  if(!r.rows[0]) throw new Error('VIP_LEVEL_NOT_FOUND');
  await tx.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'admin.vip.update','vip_level',$2,$3::jsonb)`,[actorId,String(level),JSON.stringify({level,fields:Object.keys(input||{})})]);
  return r.rows[0];
 });
}
