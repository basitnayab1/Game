export type SyncDomain =
  | 'wallet'
  | 'transactions'
  | 'notifications'
  | 'kyc'
  | 'security'
  | 'rewards'
  | 'games';

export interface SyncRequest {
  userId: string;
  domains: SyncDomain[];
  clientRevision?: string;
  requestedAt: string;
}

export interface SyncResponse {
  serverRevision: string;
  refreshedDomains: SyncDomain[];
  generatedAt: string;
}

export function validateSyncRequest(request: SyncRequest): void {
  if (!request.userId.trim()) throw new Error('User context required');
  if (!request.domains.length) throw new Error('At least one sync domain required');
  if (!request.requestedAt.trim()) throw new Error('Request timestamp required');
}
