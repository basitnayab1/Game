export interface IdempotencyRecord {
  key: string;
  userId: string;
  requestHash: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  responseCode?: number;
  responseBody?: unknown;
}

export function validateIdempotencyKey(value: string | undefined): string {
  if (!value || value.length < 16 || value.length > 128) {
    throw new Error('A valid Idempotency-Key is required for protected mutations.');
  }
  return value;
}
