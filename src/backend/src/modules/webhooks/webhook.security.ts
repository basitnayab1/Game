import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyHmacSha256Signature(secret: string, rawBody: string, providedSignature: string): boolean {
  if (!secret || !providedSignature) return false;
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const provided = providedSignature.replace(/^sha256=/i, '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(provided)) return false;
  const expectedBuffer = Buffer.from(expected, 'hex');
  const providedBuffer = Buffer.from(provided, 'hex');
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export function validateWebhookEnvelope(provider: string, eventId: string, signature: string): void {
  if (!provider.trim()) throw new Error('Webhook provider required');
  if (!eventId.trim()) throw new Error('Webhook event ID required');
  if (!signature.trim()) throw new Error('Webhook signature required');
}
