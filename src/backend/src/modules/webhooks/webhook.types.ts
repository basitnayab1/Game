export type WebhookProcessingState = 'RECEIVED' | 'VERIFIED' | 'PROCESSED' | 'DUPLICATE' | 'REJECTED' | 'FAILED';

export interface WebhookEnvelope {
  provider: string;
  eventId: string;
  eventType: string;
  signature: string;
  receivedAt: string;
  payload: unknown;
}

export interface WebhookResult {
  state: WebhookProcessingState;
  eventId: string;
}
