import type { DatabaseClient } from '../../core/database/database.types.js';

const KYC_STATUSES = new Set(['not_started','in_progress','verified','rejected','additional_information_required']);
const RISK_STATUSES = new Set(['open','resolved']);
const SUPPORT_STATUSES = new Set(['open','in_progress','waiting_for_user','resolved','closed','reopened']);

export async function getAdminOverview(db: DatabaseClient) {
  const r = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM users)::int AS total_users,
      (SELECT COUNT(*) FROM users WHERE status='active')::int AS active_users,
      (SELECT COUNT(*) FROM kyc_profiles WHERE status IN ('in_progress','additional_information_required'))::int AS kyc_review_queue,
      (SELECT COUNT(*) FROM user_risk_flags WHERE status='open')::int AS open_risk_flags,
      (SELECT COUNT(*) FROM support_tickets WHERE status IN ('open','in_progress','reopened'))::int AS open_support,
      (SELECT COUNT(*) FROM game_sessions WHERE status IN ('created','active'))::int AS active_game_sessions,
      (SELECT COUNT(*) FROM admin_users WHERE status='active')::int AS active_admins`);
  return r.rows[0];
}

export async function listAdminUsers(db: DatabaseClient, query?: string, status?: string) {
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (query?.trim()) { params.push(`%${query.trim()}%`); clauses.push(`(u.phone_e164 ILIKE $${params.length} OR COALESCE(up.username,'') ILIKE $${params.length} OR COALESCE(up.display_name,'') ILIKE $${params.length})`); }
  if (status) { params.push(status); clauses.push(`u.status=$${params.length}`); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const r = await db.query(`SELECT u.id,u.phone_e164,u.status,u.created_at,u.updated_at,up.username,up.display_name,up.country_code,up.language_code,
    COALESCE(k.status,'not_started') AS kyc_status,ks.metadata->>'documentNumber' AS cnic_number,ks.metadata->>'fullName' AS full_name,COALESCE(ks.metadata->>'documentType','id_card') AS document_type,ks.document_front,ks.document_back,
    (SELECT COUNT(*) FROM user_risk_flags rf WHERE rf.user_id=u.id AND rf.status='open')::int AS open_risk_flags
    FROM users u LEFT JOIN user_profiles up ON up.user_id=u.id LEFT JOIN kyc_profiles k ON k.user_id=u.id
    LEFT JOIN LATERAL (
      SELECT s.metadata,
        (SELECT d.storage_key FROM kyc_documents d WHERE d.kyc_profile_id=k.id AND d.document_type LIKE '%front' ORDER BY d.created_at DESC LIMIT 1) AS document_front,
        (SELECT d.storage_key FROM kyc_documents d WHERE d.kyc_profile_id=k.id AND d.document_type LIKE '%back' ORDER BY d.created_at DESC LIMIT 1) AS document_back
      FROM kyc_submissions s WHERE s.kyc_profile_id=k.id ORDER BY s.submitted_at DESC LIMIT 1
    ) ks ON TRUE ${where}
    ORDER BY u.created_at DESC LIMIT 200`, params);
  return r.rows;
}

export async function getAdminUser(db: DatabaseClient, userId: string) {
  const u = await db.query(`SELECT u.id,u.phone_e164,u.date_of_birth,u.status,u.phone_verified_at,u.created_at,u.updated_at,up.username,up.display_name,up.country_code,up.language_code,
    COALESCE(k.status,'not_started') AS kyc_status,ks.metadata->>'documentNumber' AS cnic_number,ks.metadata->>'fullName' AS full_name,COALESCE(ks.metadata->>'documentType','id_card') AS document_type,ks.document_front,ks.document_back,k.verified_at
    FROM users u LEFT JOIN user_profiles up ON up.user_id=u.id LEFT JOIN kyc_profiles k ON k.user_id=u.id
    LEFT JOIN LATERAL (
      SELECT s.metadata,
        (SELECT d.storage_key FROM kyc_documents d WHERE d.kyc_profile_id=k.id AND d.document_type LIKE '%front' ORDER BY d.created_at DESC LIMIT 1) AS document_front,
        (SELECT d.storage_key FROM kyc_documents d WHERE d.kyc_profile_id=k.id AND d.document_type LIKE '%back' ORDER BY d.created_at DESC LIMIT 1) AS document_back
      FROM kyc_submissions s WHERE s.kyc_profile_id=k.id ORDER BY s.submitted_at DESC LIMIT 1
    ) ks ON TRUE WHERE u.id=$1`, [userId]);
  if (!u.rows[0]) throw new Error('USER_NOT_FOUND');
  const [risk, sessions, closure] = await Promise.all([
    db.query(`SELECT id,flag_code,severity,status,source,metadata,created_at,resolved_at FROM user_risk_flags WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`, [userId]),
    db.query(`SELECT id,device_id,expires_at,revoked_at,created_at FROM user_sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`, [userId]),
    db.query(`SELECT id,status,reason_code,requested_at,closed_at FROM account_closure_requests WHERE user_id=$1 ORDER BY requested_at DESC LIMIT 20`, [userId]),
  ]);
  return { user:u.rows[0], riskFlags:risk.rows, sessions:sessions.rows, closures:closure.rows };
}

export async function reviewKyc(db: DatabaseClient, actorId: string, userId: string, status: string, note?: string) {
  if (!KYC_STATUSES.has(status)) throw new Error('INVALID_KYC_STATUS');
  return db.transaction(async tx => {
    const p = await tx.query<{id:string}>(`SELECT id FROM kyc_profiles WHERE user_id=$1 FOR UPDATE`, [userId]);
    if (!p.rows[0]) {
      await tx.query(
        `INSERT INTO kyc_profiles(user_id, status, verified_at, updated_at)
         VALUES($1, $2, CASE WHEN $2='verified' THEN now() ELSE NULL END, now())`,
        [userId, status]
      );
    } else {
      await tx.query(`UPDATE kyc_profiles SET status=$2, verified_at=CASE WHEN $2='verified' THEN now() ELSE NULL END, updated_at=now() WHERE user_id=$1`, [userId,status]);
    }
    await tx.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'admin.kyc.review','user',$2,$3::jsonb)`, [actorId,userId,JSON.stringify({status,note:note?.slice(0,500) ?? null})]);
    return { userId,status };
  });
}

export async function updateRiskFlag(db: DatabaseClient, actorId: string, flagId: string, status: string) {
  if (!RISK_STATUSES.has(status)) throw new Error('INVALID_RISK_STATUS');
  return db.transaction(async tx => {
    const r = await tx.query<{id:string;user_id:string}>(`UPDATE user_risk_flags SET status=$2,resolved_at=CASE WHEN $2='resolved' THEN now() ELSE NULL END WHERE id=$1 RETURNING id,user_id`, [flagId,status]);
    if (!r.rows[0]) throw new Error('RISK_FLAG_NOT_FOUND');
    await tx.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'admin.risk.update','risk_flag',$2,$3::jsonb)`, [actorId,flagId,JSON.stringify({status,userId:r.rows[0].user_id})]);
    return { id:flagId,status };
  });
}

export async function updateSupportTicket(db: DatabaseClient, actorId: string, ticketId: string, status: string) {
  if (!SUPPORT_STATUSES.has(status)) throw new Error('INVALID_SUPPORT_STATUS');
  return db.transaction(async tx => {
    const r = await tx.query<{id:string;user_id:string}>(`UPDATE support_tickets SET status=$2,updated_at=now() WHERE id=$1 RETURNING id,user_id`, [ticketId,status]);
    if (!r.rows[0]) throw new Error('SUPPORT_TICKET_NOT_FOUND');
    await tx.query(`INSERT INTO audit_events(actor_user_id,action,entity_type,entity_id,metadata) VALUES($1,'admin.support.status','support_ticket',$2,$3::jsonb)`, [actorId,ticketId,JSON.stringify({status,userId:r.rows[0].user_id})]);
    return { id:ticketId,status };
  });
}

export async function getSupportTicketAdmin(db: DatabaseClient, ticketId: string) {
  const t = await db.query(`SELECT id,user_id,category,status,subject,created_at,updated_at FROM support_tickets WHERE id=$1`, [ticketId]);
  if (!t.rows[0]) throw new Error('SUPPORT_TICKET_NOT_FOUND');
  const m = await db.query(`SELECT id,sender_user_id,message,created_at FROM support_messages WHERE ticket_id=$1 ORDER BY created_at ASC`, [ticketId]);
  return { ticket:t.rows[0], messages:m.rows };
}

export async function listSupportTicketsAdmin(db: DatabaseClient, status?: string) {
  const params: unknown[] = []; const where = status ? `WHERE st.status=$1` : ''; if (status) params.push(status);
  const r = await db.query(`SELECT st.id,st.user_id,st.category,st.status,st.subject,st.created_at,st.updated_at,COALESCE(up.username,up.display_name,u.phone_e164) AS user_label
    FROM support_tickets st JOIN users u ON u.id=st.user_id LEFT JOIN user_profiles up ON up.user_id=u.id ${where} ORDER BY st.updated_at DESC LIMIT 200`, params);
  return r.rows;
}
