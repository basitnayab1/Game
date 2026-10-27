export type VerificationResult = { verified: boolean; reason?: string };
export interface WebhookVerifier { verify(rawBody: string, signature: string, secret: string): VerificationResult; }
export function requireVerified(result: VerificationResult): void { if (!result.verified) throw new Error('WEBHOOK_VERIFICATION_FAILED'); }
