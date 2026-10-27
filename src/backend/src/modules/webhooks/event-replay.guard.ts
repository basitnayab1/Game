export interface WebhookEventKey {
  provider: string;
  eventId: string;
}

export function validateWebhookEventKey(key: WebhookEventKey): void {
  if (!key.provider.trim()) throw new Error('webhook provider required');
  if (!key.eventId.trim()) throw new Error('webhook event ID required');
}

/** The DB must enforce uniqueness on (provider,event_id); processing must be idempotent. */
export const webhookReplayPolicy = Object.freeze({
  uniqueProviderEventId: true,
  verifySignatureBeforeProcessing: true,
  validatePayloadBeforeFinancialMutation: true,
  duplicateEventHasNoSecondFinancialEffect: true,
});
