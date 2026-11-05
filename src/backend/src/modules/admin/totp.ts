import crypto from 'node:crypto';
import { env } from '../../config/env.js';

/**
 * Time-based one-time codes (RFC 6238: SHA-1, 6 digits, 30 s steps), the
 * format Google Authenticator and similar apps use.
 */

const STEP_SECONDS = 30;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateSecret(): string {
  const bytes = crypto.randomBytes(20);
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += BASE32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function base32Decode(secret: string): Buffer {
  let bits = '';
  for (const c of secret.replace(/=+$/, '').toUpperCase()) {
    const v = BASE32.indexOf(c);
    if (v < 0) throw new Error('INVALID_SECRET');
    bits += v.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export function codeAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const o = h[h.length - 1] & 0x0f;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

export function currentStep(nowMs = Date.now()): number {
  return Math.floor(nowMs / 1000 / STEP_SECONDS);
}

/** The step the code matches (allowing one step of clock drift), or null. */
export function matchStep(secret: string, code: string, nowMs = Date.now()): number | null {
  const clean = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(clean)) return null;
  const now = currentStep(nowMs);
  for (const step of [now, now - 1, now + 1]) {
    const expected = Buffer.from(codeAt(secret, step));
    if (crypto.timingSafeEqual(expected, Buffer.from(clean))) return step;
  }
  return null;
}

export function otpauthUri(secret: string, accountName: string): string {
  const label = encodeURIComponent(`N5 Admin:${accountName}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent('N5 Admin')}&algorithm=SHA1&digits=6&period=30`;
}

// Secrets are encrypted at rest with a key from ADMIN_TOTP_KEY, or derived
// from the access-token secret when that is not set.
function key(): Buffer {
  const material = process.env.ADMIN_TOTP_KEY || env.JWT_ACCESS_SECRET;
  if (!material) throw new Error('ADMIN_TOTP_KEY_NOT_CONFIGURED');
  return crypto.createHash('sha256').update(`n5-admin-totp:${material}`).digest();
}

export function encryptSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(secret, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString('base64')).join('.');
}

export function decryptSecret(stored: string): string {
  const [iv, tag, data] = stored.split('.').map((s) => Buffer.from(s, 'base64'));
  const d = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString('utf8');
}
