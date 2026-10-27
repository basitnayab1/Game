export type IdempotencyStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface IdempotencyRecord {
  key: string;
  operation: string;
  status: IdempotencyStatus;
  responseHash?: string;
  createdAt: string;
}

/**
 * Contract-level guard only. Production persistence MUST enforce a unique
 * (scope, operation, key) constraint inside the same DB transaction as the
 * financial mutation. This in-memory implementation is intentionally not a
 * source of financial truth.
 */
export class IdempotencyService {
  begin(key: string, operation: string): IdempotencyRecord {
    if (!key.trim()) throw new Error('Idempotency key is required');
    if (!operation.trim()) throw new Error('Operation is required');
    return { key: key.trim(), operation: operation.trim(), status: 'IN_PROGRESS', createdAt: new Date().toISOString() };
  }

  complete(record: IdempotencyRecord, responseHash: string): IdempotencyRecord {
    if (!responseHash.trim()) throw new Error('Response hash is required');
    return { ...record, status: 'COMPLETED', responseHash };
  }

  fail(record: IdempotencyRecord): IdempotencyRecord {
    return { ...record, status: 'FAILED' };
  }
}

export const IDEMPOTENCY_PERSISTENCE_CONTRACT = Object.freeze({
  uniqueScopeOperationKey: true,
  sameDbTransactionAsMutation: true,
  replayCompletedResponse: true,
  neverTrustClientStatus: true,
});
