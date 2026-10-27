import crypto from 'node:crypto';
import type { DatabaseClient } from '../../core/database/database.types.js';

export type PaymentIdempotencyScope = 'deposit' | 'withdrawal';
export type PaymentIdempotencyStatus = 'in_progress' | 'completed' | 'failed';

export interface PaymentIdempotencyRecord {
  id: string;
  userId: string;
  scope: PaymentIdempotencyScope;
  idempotencyKey: string;
  requestHash: string;
  status: PaymentIdempotencyStatus;
  responseCode?: number;
  responseBody?: any;
  transactionId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AcquireIdempotencyResult {
  action: 'proceed' | 'replay' | 'conflict' | 'in_progress' | 'unavailable';
  recordId?: string;
  cachedResponse?: {
    statusCode: number;
    body: any;
  };
  conflictReason?: string;
}

export class PaymentIdempotencyService {
  /**
   * Produce canonical deterministic SHA-256 hash of payload fields.
   */
  public static computePayloadHash(payload: Record<string, any>): string {
    const canonical: Record<string, any> = {};
    const sortedKeys = Object.keys(payload).sort();
    for (const key of sortedKeys) {
      const val = payload[key];
      if (val !== undefined && val !== null) {
        if (typeof val === 'string') {
          canonical[key] = val.trim();
        } else if (typeof val === 'number') {
          canonical[key] = Number(val);
        } else {
          canonical[key] = val;
        }
      }
    }
    const serialized = JSON.stringify(canonical);
    return crypto.createHash('sha256').update(serialized, 'utf8').digest('hex');
  }

  /**
   * Extract idempotency key from request headers or body.
   * If not provided, fallbackKey (e.g. derived from TRX for deposits) is used.
   */
  public static extractIdempotencyKey(req: any, fallbackKey?: string): string | null {
    const headerKey = req.headers?.['idempotency-key'] || req.headers?.['x-idempotency-key'];
    const bodyKey = req.body?.idempotencyKey || req.body?.idempotency_key;
    const raw = String(headerKey || bodyKey || fallbackKey || '').trim();
    if (!raw) return null;
    return raw.slice(0, 128);
  }

  /**
   * Verify provider-scoped deposit reference uniqueness in the database.
   * Returns true if reference is unique (available), false if already used.
   */
  public static async isDepositReferenceUnique(
    db: DatabaseClient,
    gateway: string,
    trxId: string,
  ): Promise<boolean> {
    const cleanGateway = gateway.trim().toLowerCase();
    const cleanTrx = trxId.trim().toLowerCase();

    // Database-backed provider/reference uniqueness
    const res = await db.query<{ id: string }>(
      `SELECT id FROM deposits
        WHERE LOWER(provider_name) = $1
          AND LOWER(provider_reference) = $2
        LIMIT 1`,
      [cleanGateway, cleanTrx],
    );

    return res.rows.length === 0;
  }

  /**
   * Acquire or inspect idempotency record before performing mutation.
   */
  public static async acquire(
    db: DatabaseClient,
    params: {
      userId: string;
      scope: PaymentIdempotencyScope;
      key: string;
      requestHash: string;
    },
  ): Promise<AcquireIdempotencyResult> {
    const { userId, scope, key, requestHash } = params;
    // Database-backed durable idempotency
    try {
      // Check existing row
      const existingRes = await db.query<{
        id: string;
        status: PaymentIdempotencyStatus;
        request_hash: string;
        response_code: number;
        response_body: any;
      }>(
        `SELECT id, status, request_hash, response_code, response_body
           FROM payment_idempotency_records
          WHERE user_id = $1 AND scope = $2 AND idempotency_key = $3
          LIMIT 1`,
        [userId, scope, key],
      );

      if (existingRes.rows.length > 0) {
        const row = existingRes.rows[0];
        if (row.request_hash !== requestHash) {
          return {
            action: 'conflict',
            conflictReason: 'An operation with this idempotency key already exists with different request parameters.',
          };
        }
        if (row.status === 'completed') {
          return {
            action: 'replay',
            cachedResponse: {
              statusCode: row.response_code || 201,
              body: row.response_body,
            },
          };
        }
        if (row.status === 'in_progress') {
          return {
            action: 'in_progress',
            conflictReason: 'A request with this idempotency key is currently being processed. Please retry shortly.',
          };
        }

        // Previous attempt failed, reactivate to in_progress for retry
        await db.query(
          `UPDATE payment_idempotency_records
              SET status = 'in_progress',
                  request_hash = $1,
                  error_message = null,
                  updated_at = now()
            WHERE id = $2`,
          [requestHash, row.id],
        );
        return { action: 'proceed', recordId: row.id };
      }

      // No record exists, insert in_progress
      const insertRes = await db.query<{ id: string }>(
        `INSERT INTO payment_idempotency_records
           (user_id, scope, idempotency_key, request_hash, status)
         VALUES ($1, $2, $3, $4, 'in_progress')
         ON CONFLICT (user_id, scope, idempotency_key) DO NOTHING
         RETURNING id`,
        [userId, scope, key, requestHash],
      );

      if (insertRes.rows.length > 0) {
        return { action: 'proceed', recordId: insertRes.rows[0].id };
      }

      // Concurrent race condition: another query inserted simultaneously
      const raceCheck = await db.query<{
        id: string;
        status: PaymentIdempotencyStatus;
        request_hash: string;
        response_code: number;
        response_body: any;
      }>(
        `SELECT id, status, request_hash, response_code, response_body
           FROM payment_idempotency_records
          WHERE user_id = $1 AND scope = $2 AND idempotency_key = $3
          LIMIT 1`,
        [userId, scope, key],
      );

      if (raceCheck.rows.length > 0) {
        const raceRow = raceCheck.rows[0];
        if (raceRow.request_hash !== requestHash) {
          return {
            action: 'conflict',
            conflictReason: 'An operation with this idempotency key already exists with different request parameters.',
          };
        }
        if (raceRow.status === 'completed') {
          return {
            action: 'replay',
            cachedResponse: {
              statusCode: raceRow.response_code || 201,
              body: raceRow.response_body,
            },
          };
        }
      }

      return {
        action: 'in_progress',
        conflictReason: 'A request with this idempotency key is currently being processed. Please retry shortly.',
      };
    } catch (err: any) {
      // Fail closed: proceeding without a durable record could duplicate a payment.
      console.error('[IDEMPOTENCY:ACQUIRE:ERROR]', err.message);
      return {
        action: 'unavailable',
        conflictReason: 'Idempotency store is temporarily unavailable. Please retry shortly.',
      };
    }
  }

  /**
   * Mark idempotency record as completed with cached response.
   */
  public static async complete(
    db: DatabaseClient,
    params: {
      userId: string;
      scope: PaymentIdempotencyScope;
      key: string;
      statusCode: number;
      responseBody: any;
      transactionId?: string;
    },
  ): Promise<void> {
    const { userId, scope, key, statusCode, responseBody, transactionId } = params;
    try {
      await db.query(
        `UPDATE payment_idempotency_records
            SET status = 'completed',
                response_code = $1,
                response_body = $2,
                transaction_id = $3,
                updated_at = now()
          WHERE user_id = $4 AND scope = $5 AND idempotency_key = $6`,
        [statusCode, JSON.stringify(responseBody), transactionId || null, userId, scope, key],
      );
    } catch (err: any) {
      console.error('[IDEMPOTENCY:COMPLETE:ERROR]', err.message);
    }
  }

  /**
   * Mark idempotency record as failed so retry can be attempted or inspected.
   */
  public static async fail(
    db: DatabaseClient,
    params: {
      userId: string;
      scope: PaymentIdempotencyScope;
      key: string;
      errorMessage: string;
    },
  ): Promise<void> {
    const { userId, scope, key, errorMessage } = params;
    try {
      await db.query(
        `UPDATE payment_idempotency_records
            SET status = 'failed',
                error_message = $1,
                updated_at = now()
          WHERE user_id = $2 AND scope = $3 AND idempotency_key = $4`,
        [errorMessage, userId, scope, key],
      );
    } catch (err: any) {
      console.error('[IDEMPOTENCY:FAIL:ERROR]', err.message);
    }
  }
}
