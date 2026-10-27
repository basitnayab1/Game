import 'dotenv/config';
import { z } from 'zod';
import { validateConfig } from '../core/config/env.schema';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  APP_NAME: z.string().default('N5 Game'),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('*'),
  LOG_LEVEL: z.string().default('info'),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  ACCESS_TOKEN_MINUTES: z.coerce.number().int().positive().default(30),
  REFRESH_TOKEN_DAYS: z.coerce.number().int().positive().default(30),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  // SMS & OTP Providers
  OTP_CHANNEL: z.string().default('whatsapp'),
  WHATSAPP_GATEWAY_URL: z.string().optional(),
  WHATSAPP_GATEWAY_API_KEY: z.string().optional(),
  // Shared secret the WhatsApp gateway must send (x-webhook-secret) when forwarding inbound messages.
  WHATSAPP_INBOUND_SECRET: z.string().optional(),
  WHATSAPP_SENDER_NUMBER: z.string().default('+923076975507'),
  SMS_PROVIDER: z.string().default('console'),
  SMS_API_KEY: z.string().optional(),
  SMS_API_URL: z.string().optional(),
  SMS_SENDER_ID: z.string().default('N5GAME'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // Payment Gateways (Easypaisa & JazzCash)
  EASYPAISA_STORE_ID: z.string().optional(),
  EASYPAISA_HASH_KEY: z.string().optional(),
  EASYPAISA_ACCOUNT_NUM: z.string().optional(),
  EASYPAISA_WEBHOOK_SECRET: z.string().optional(),
  EASYPAISA_ENV: z.string().default('sandbox'),
  JAZZCASH_MERCHANT_ID: z.string().optional(),
  JAZZCASH_PASSWORD: z.string().optional(),
  JAZZCASH_HASH_KEY: z.string().optional(),
  JAZZCASH_WEBHOOK_SECRET: z.string().optional(),
  JAZZCASH_ENV: z.string().default('sandbox'),

  // KYC Verification Providers
  KYC_PROVIDER: z.string().default('shuftipro'),
  KYC_CLIENT_ID: z.string().optional(),
  KYC_SECRET_KEY: z.string().optional(),
  KYC_WEBHOOK_SECRET: z.string().optional(),
});

const parsed = schema.parse(process.env);

const configErrors = validateConfig({
  nodeEnv: parsed.NODE_ENV,
  port: parsed.PORT,
  apiPrefix: parsed.API_PREFIX,
  databaseUrl: parsed.DATABASE_URL,
  redisUrl: parsed.REDIS_URL,
  jwtAccessSecret: parsed.JWT_ACCESS_SECRET,
  jwtRefreshSecret: parsed.JWT_REFRESH_SECRET,
  corsOrigin: parsed.CORS_ORIGIN,
});

if (configErrors.length > 0) {
  throw new Error(`Invalid N5 configuration: ${configErrors.join('; ')}`);
}

export const env = parsed;
