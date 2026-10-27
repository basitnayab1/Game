export type KycStatus = 'NOT_STARTED'|'IN_PROGRESS'|'VERIFIED'|'REJECTED'|'ADDITIONAL_INFORMATION_REQUIRED';
export type SecurityDevice = { id:string; label:string; lastSeenAt:string; current:boolean };
export const securityKycPlayerEndpoints = { kyc:'/api/v1/kyc', kycSubmit:'/api/v1/kyc/submit', devices:'/api/v1/security/devices', sessions:'/api/v1/security/sessions', logoutOther:'/api/v1/security/sessions/revoke-others', loginHistory:'/api/v1/security/login-history' } as const;

/** Client may request a KYC submission, but status is always assigned by the server/provider. */
export function assertClientCannotSetKycStatus(input: Record<string, unknown>): void {
  if ('status' in input || 'verified' in input || 'verificationResult' in input) {
    throw new Error('KYC status is server-authoritative');
  }
}

export function assertAuthenticatedUserScope(requestUserId: string, resourceUserId: string): void {
  if (!requestUserId || requestUserId !== resourceUserId) throw new Error('Unauthorized resource scope');
}
