import type { DatabaseClient } from '../../core/database/database.types.js';

export type KycStatus = 'not_started'|'in_progress'|'verified'|'rejected'|'additional_information_required';

export async function getKycStatus(db: DatabaseClient, userId: string) {
  const r = await db.query<{status:KycStatus;verified_at:string|null;updated_at:string}>(
    `SELECT status, verified_at, updated_at FROM kyc_profiles WHERE user_id=$1`, [userId]);
  return r.rows[0] ?? {status:'not_started' as KycStatus, verified_at:null, updated_at:new Date().toISOString()};
}

export type KycSubmissionDetails = {
  provider?: string;
  providerReference?: string;
  fullName?: string;
  documentType?: string;
  documentNumber?: string;
  documentFrontUrl?: string;
  documentBackUrl?: string;
};

export async function requestKycSubmission(db: DatabaseClient, userId: string, details: KycSubmissionDetails = {}) {
  const { provider, providerReference, documentFrontUrl, documentBackUrl } = details;
  const metadata = {
    fullName: details.fullName ?? null,
    documentType: details.documentType ?? null,
    documentNumber: details.documentNumber ?? null,
  };
  return db.transaction(async tx => {
    const profile = await tx.query<{id:string;status:KycStatus}>(
      `SELECT id,status FROM kyc_profiles WHERE user_id=$1 FOR UPDATE`, [userId]);
    let profileId = profile.rows[0]?.id;
    if (!profileId) {
      const created = await tx.query<{id:string}>(
        `INSERT INTO kyc_profiles(user_id,status) VALUES($1,'in_progress') RETURNING id`, [userId]);
      profileId = created.rows[0].id;
    } else if (profile.rows[0].status === 'verified') {
      throw new Error('KYC_ALREADY_VERIFIED');
    } else {
      await tx.query(`UPDATE kyc_profiles SET status='in_progress',updated_at=now() WHERE id=$1`, [profileId]);
    }
    if (providerReference) {
      await tx.query(`UPDATE kyc_profiles SET provider_reference=$2 WHERE id=$1`, [profileId, providerReference]);
    }
    const submission = await tx.query<{id:string;submitted_at:string}>(
      `INSERT INTO kyc_submissions(kyc_profile_id,provider,provider_reference,requested_status,metadata) VALUES($1,$2,$3,'in_progress',$4::jsonb) RETURNING id,submitted_at`,
      [profileId, provider ?? null, providerReference ?? null, JSON.stringify(metadata)]);
    const documentType = details.documentType ?? 'id_card';
    for (const [side, storageKey] of [['front', documentFrontUrl], ['back', documentBackUrl]] as const) {
      if (!storageKey) continue;
      await tx.query(`INSERT INTO kyc_documents(kyc_profile_id,document_type,storage_key) VALUES($1,$2,$3)`,
        [profileId, `${documentType}_${side}`, storageKey]);
    }
    return {submissionId:submission.rows[0].id, status:'in_progress' as const, submittedAt:submission.rows[0].submitted_at};
  });
}

export type KycProviderDecision = {
  userId: string;
  referenceId: string;
  status: KycStatus;
  documentType?: string;
  documentNumber?: string;
  declineReason?: string;
  verifiedAt?: string;
};

/**
 * Applies a provider callback whose signature has already been verified.
 * The profile is resolved by the stored provider reference; providers that
 * report their own applicant id (Sumsub) fall back to the user id we sent them.
 */
export async function applyKycProviderDecision(db: DatabaseClient, decision: KycProviderDecision) {
  return db.transaction(async tx => {
    const byRef = await tx.query<{id:string;user_id:string}>(
      `SELECT p.id,p.user_id FROM kyc_profiles p
        WHERE p.provider_reference=$1
           OR p.id IN (SELECT kyc_profile_id FROM kyc_submissions WHERE provider_reference=$1)
        LIMIT 1 FOR UPDATE`, [decision.referenceId]);
    let profile = byRef.rows[0];
    if (!profile && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decision.userId)) {
      profile = (await tx.query<{id:string;user_id:string}>(
        `SELECT id,user_id FROM kyc_profiles WHERE user_id=$1 FOR UPDATE`, [decision.userId])).rows[0];
    }
    if (!profile) throw new Error('KYC_PROFILE_NOT_FOUND');
    await tx.query(
      `UPDATE kyc_profiles SET status=$2, verified_at=$3, updated_at=now() WHERE id=$1`,
      [profile.id, decision.status, decision.status === 'verified' ? (decision.verifiedAt ?? new Date().toISOString()) : null]);
    await tx.query(
      `UPDATE kyc_submissions
          SET reviewed_at=now(),
              metadata = metadata || $3::jsonb
        WHERE id = (SELECT id FROM kyc_submissions WHERE kyc_profile_id=$1 AND (provider_reference=$2 OR provider_reference IS NULL)
                     ORDER BY submitted_at DESC LIMIT 1)`,
      [profile.id, decision.referenceId, JSON.stringify({
        providerStatus: decision.status,
        providerDocumentType: decision.documentType ?? null,
        providerDocumentNumber: decision.documentNumber ?? null,
        declineReason: decision.declineReason ?? null,
      })]);
    return { userId: profile.user_id, status: decision.status };
  });
}

export async function getSecurityOverview(db: DatabaseClient, userId: string) {
  const [devices,sessions,flags,logins] = await Promise.all([
    db.query(`SELECT id,device_name,platform,last_seen_at FROM user_devices WHERE user_id=$1 ORDER BY last_seen_at DESC`,[userId]),
    db.query(`SELECT id,device_id,expires_at,revoked_at,created_at FROM user_sessions WHERE user_id=$1 ORDER BY created_at DESC`,[userId]),
    db.query(`SELECT flag_code,severity,status,source,created_at FROM user_risk_flags WHERE user_id=$1 AND status='open' ORDER BY created_at DESC`,[userId]),
    db.query(`SELECT outcome,created_at FROM security_login_events WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`,[userId]),
  ]);
  return {devices:devices.rows,sessions:sessions.rows,openRiskFlags:flags.rows,loginHistory:logins.rows};
}

export async function revokeOtherSessions(db: DatabaseClient, userId: string, currentSessionId: string) {
  const r = await db.query<{count:string}>(
    `WITH changed AS (UPDATE user_sessions SET revoked_at=now() WHERE user_id=$1 AND id<>$2 AND revoked_at IS NULL RETURNING id) SELECT count(*)::text AS count FROM changed`,
    [userId,currentSessionId]);
  return {revokedCount:Number(r.rows[0]?.count ?? 0)};
}
