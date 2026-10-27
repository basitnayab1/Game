export interface ProviderEventRecord {
  provider: string;
  eventId: string;
  eventType: string;
  signatureVerified: boolean;
  payloadHash: string;
  state: 'RECEIVED' | 'VERIFIED' | 'PROCESSED' | 'DUPLICATE' | 'REJECTED' | 'FAILED';
}

export interface ProviderEventStore {
  /**
   * Records a provider event exactly once. Implementations must enforce
   * UNIQUE(provider,event_id) in PostgreSQL and return duplicate=true on replay.
   */
  recordOnce(event: ProviderEventRecord): Promise<{ duplicate: boolean }>;
}

/**
 * Compliance gate: recording a provider event does NOT authorize or perform
 * any wallet credit. A separately authorized settlement workflow is required.
 */
export const providerEventFinancialBoundary = Object.freeze({
  eventRecordingMayNotCreditWallet: true,
  signatureMustBeVerifiedBeforeFinancialUse: true,
  providerAuthorizationRequired: true,
});
