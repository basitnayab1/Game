import { Pool } from 'pg';
import type { DatabaseClient, DatabaseHealth } from './database.types';

export type ConnectedDatabaseClient = DatabaseClient & {
  pool: Pool;
  close(): Promise<void>;
};

export function createDatabaseClient(connectionString: string): ConnectedDatabaseClient {
  const pool = new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  return {
    pool,
    async query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
      const result = await pool.query(sql, params);
      return { rows: result.rows as T[] };
    },
    async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const txClient: DatabaseClient = {
          async query<R = unknown>(sql: string, params?: unknown[]): Promise<{ rows: R[] }> {
            const res = await client.query(sql, params);
            return { rows: res.rows as R[] };
          },
          async transaction<R>(innerFn: (txInner: DatabaseClient) => Promise<R>): Promise<R> {
            return innerFn(txClient);
          },
        };
        const result = await fn(txClient);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    async close() {
      await pool.end();
    },
  };
}

export async function checkDatabaseHealth(client: DatabaseClient, timeoutMs = 3000): Promise<DatabaseHealth> {
  const start = Date.now();
  try {
    await Promise.race([
      client.query('SELECT 1'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DATABASE_HEALTH_TIMEOUT')), timeoutMs)),
    ]);
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false };
  }
}

