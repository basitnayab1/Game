import { describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import {
  runMigrations,
  getMigrationFiles,
  getMigrationStatus,
  ensureMigrationsTable,
  MIGRATION_ADVISORY_LOCK_ID,
} from '../src/core/database/migrator.js';
import {
  bootstrapAdminOperator,
  validateAdminPhone,
  validateAdminPassword,
  generateSecurePassword,
} from '../src/scripts/bootstrap-admin.js';
import type { DatabaseClient } from '../src/core/database/database.types.js';

const MIGRATIONS_DIR = join(process.cwd(), '..', 'database', 'migrations');

describe('Database Migration Engine & Workflow', () => {
  it('discovers all migrations in sequential order with valid checksums', () => {
    const files = getMigrationFiles(MIGRATIONS_DIR);
    expect(files.length).toBeGreaterThanOrEqual(36);
    expect(files[0].name).toBe('001_initial_foundation.sql');
    expect(files[files.length - 1].name).toBe('037_auth_otp_challenges.sql');

    // Numbers must be contiguous 1..N
    const numbers = files.map((f) => f.number);
    expect(numbers).toEqual(Array.from({ length: files.length }, (_, i) => i + 1));

    // Checksums must be 64-char sha256 hex strings
    for (const f of files) {
      expect(f.checksum).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('performs clean install on empty database and applies all migrations sequentially', async () => {
    const appliedHistory: string[] = [];
    let lockHeld = false;

    const mockDb: DatabaseClient = {
      async query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
        if (sql.includes('pg_try_advisory_lock')) {
          lockHeld = true;
          return { rows: [{ acquired: true }] as T[] };
        }
        if (sql.includes('pg_advisory_unlock')) {
          lockHeld = false;
          return { rows: [{ released: true }] as T[] };
        }
        if (sql.includes('FROM schema_migrations ORDER BY id ASC')) {
          return { rows: appliedHistory.map((name, i) => ({ id: i + 1, name })) as T[] };
        }
        if (sql.includes('information_schema.tables')) {
          // Empty database: users table does not exist
          return { rows: [{ exists: false }] as T[] };
        }
        if (sql.includes('INSERT INTO schema_migrations')) {
          const name = String(params?.[0] || '');
          appliedHistory.push(name);
          return { rows: [] };
        }
        return { rows: [] };
      },
      async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
        return fn(mockDb);
      },
    };

    const files = getMigrationFiles(MIGRATIONS_DIR);
    const result = await runMigrations(mockDb, { migrationsDir: MIGRATIONS_DIR });

    expect(result.success).toBe(true);
    expect(result.total).toBe(files.length);
    expect(result.applied.length).toBe(files.length);
    expect(result.applied[0]).toBe('001_initial_foundation.sql');
    expect(result.applied[files.length - 1]).toBe(files[files.length - 1].name);
    expect(lockHeld).toBe(false); // Verified advisory lock released
  });

  it('performs upgrade on existing database by applying only pending migrations', async () => {
    // Existing DB where all but the last migration were already applied
    const files = getMigrationFiles(MIGRATIONS_DIR);
    const appliedHistory: string[] = files.slice(0, files.length - 1).map((f) => f.name);

    const executedSql: string[] = [];

    const mockDb: DatabaseClient = {
      async query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
        if (sql.includes('pg_try_advisory_lock')) {
          return { rows: [{ acquired: true }] as T[] };
        }
        if (sql.includes('pg_advisory_unlock')) {
          return { rows: [{ released: true }] as T[] };
        }
        if (sql.includes('FROM schema_migrations ORDER BY id ASC')) {
          return { rows: appliedHistory.map((name, i) => ({ id: i + 1, name })) as T[] };
        }
        if (sql.includes('INSERT INTO schema_migrations')) {
          const name = String(params?.[0] || '');
          appliedHistory.push(name);
          return { rows: [] };
        }
        executedSql.push(sql);
        return { rows: [] };
      },
      async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
        return fn(mockDb);
      },
    };

    const result = await runMigrations(mockDb, { migrationsDir: MIGRATIONS_DIR });

    expect(result.success).toBe(true);
    expect(result.applied.length).toBe(1);
    expect(result.applied[0]).toBe(files[files.length - 1].name);
    expect(result.total).toBe(files.length);
    expect(appliedHistory.length).toBe(files.length);
  });

  it('is idempotent and reports zero pending migrations on repeated runs', async () => {
    const files = getMigrationFiles(MIGRATIONS_DIR);
    const appliedHistory: string[] = files.map((f) => f.name);

    const mockDb: DatabaseClient = {
      async query<T = unknown>(sql: string): Promise<{ rows: T[] }> {
        if (sql.includes('pg_try_advisory_lock')) {
          return { rows: [{ acquired: true }] as T[] };
        }
        if (sql.includes('pg_advisory_unlock')) {
          return { rows: [{ released: true }] as T[] };
        }
        if (sql.includes('FROM schema_migrations ORDER BY id ASC')) {
          return { rows: appliedHistory.map((name, i) => ({ id: i + 1, name })) as T[] };
        }
        return { rows: [] };
      },
      async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
        return fn(mockDb);
      },
    };

    const result = await runMigrations(mockDb, { migrationsDir: MIGRATIONS_DIR });

    expect(result.success).toBe(true);
    expect(result.applied.length).toBe(0);
    expect(result.pendingCount).toBe(0);
  });

  it('prevents concurrent execution when another process holds advisory lock', async () => {
    const mockDb: DatabaseClient = {
      async query<T = unknown>(sql: string): Promise<{ rows: T[] }> {
        if (sql.includes('pg_try_advisory_lock')) {
          // Lock held by another container/instance
          return { rows: [{ acquired: false }] as T[] };
        }
        return { rows: [] };
      },
      async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
        return fn(mockDb);
      },
    };

    await expect(runMigrations(mockDb, { migrationsDir: MIGRATIONS_DIR })).rejects.toThrow(
      /MIGRATION_CONCURRENCY_ERROR/,
    );
  });

  it('rolls back atomic transaction and produces detailed failure report on SQL error', async () => {
    const appliedHistory: string[] = [];
    let rolledBack = false;

    const mockDb: DatabaseClient = {
      async query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
        if (sql.includes('pg_try_advisory_lock')) {
          return { rows: [{ acquired: true }] as T[] };
        }
        if (sql.includes('pg_advisory_unlock')) {
          return { rows: [{ released: true }] as T[] };
        }
        if (sql.includes('FROM schema_migrations ORDER BY id ASC')) {
          return { rows: appliedHistory.map((name, i) => ({ id: i + 1, name })) as T[] };
        }
        if (sql.includes('information_schema.tables')) {
          return { rows: [{ exists: false }] as T[] };
        }
        if (sql.includes('CREATE TABLE IF NOT EXISTS users')) {
          // Simulate fatal syntax or constraint error during migration execution
          throw new Error('syntax error at or near "BROKEN_SYNTAX"');
        }
        return { rows: [] };
      },
      async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
        try {
          return await fn(mockDb);
        } catch (err) {
          rolledBack = true;
          throw err;
        }
      },
    };

    await expect(runMigrations(mockDb, { migrationsDir: MIGRATIONS_DIR })).rejects.toThrow(
      /\[MIGRATION FAILURE\] Migration "001_initial_foundation\.sql" failed/,
    );
    expect(rolledBack).toBe(true);
    expect(appliedHistory.length).toBe(0); // Nothing recorded in schema_migrations on failure
  });

  it('reports migration status table accurately', async () => {
    const files = getMigrationFiles(MIGRATIONS_DIR);
    const mockDb: DatabaseClient = {
      async query<T = unknown>(sql: string): Promise<{ rows: T[] }> {
        if (sql.includes('FROM schema_migrations ORDER BY id ASC')) {
          return {
            rows: [
              { name: files[0].name, applied_at: '2026-10-25T12:00:00Z', execution_time_ms: 15 },
              { name: files[1].name, applied_at: '2026-10-25T12:00:01Z', execution_time_ms: 8 },
            ] as T[],
          };
        }
        return { rows: [] };
      },
      async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
        return fn(mockDb);
      },
    };

    const status = await getMigrationStatus(mockDb, MIGRATIONS_DIR);
    expect(status.length).toBe(files.length);
    expect(status[0].applied).toBe(true);
    expect(status[1].applied).toBe(true);
    expect(status[2].applied).toBe(false);
  });
});

describe('Secure Admin Operator Bootstrap', () => {
  it('validates E.164 phone format and rejects invalid formats', () => {
    expect(() => validateAdminPhone('+923001234567')).not.toThrow();
    expect(() => validateAdminPhone('+12025550199')).not.toThrow();
    expect(() => validateAdminPhone('03001234567')).toThrow(/INVALID_PHONE/);
    expect(() => validateAdminPhone('not-a-number')).toThrow(/INVALID_PHONE/);
    expect(() => validateAdminPhone('')).toThrow(/INVALID_PHONE/);
  });

  it('rejects passwords shorter than 12 characters and known default public passwords', () => {
    expect(() => validateAdminPassword('short')).toThrow(/at least 12 characters/);
    expect(() => validateAdminPassword('securePassword123!')).toThrow(/INSECURE_PASSWORD/);
    expect(() => validateAdminPassword('Password123!')).toThrow(/INSECURE_PASSWORD/);
    expect(() => validateAdminPassword('CustomSecret_SecureKey2026!')).not.toThrow();
  });

  it('generates secure cryptographically strong random passwords', () => {
    const pw1 = generateSecurePassword();
    const pw2 = generateSecurePassword();
    expect(pw1.length).toBeGreaterThanOrEqual(16);
    expect(pw1).not.toBe(pw2);
  });

  it('enforces 2 active operator limit from migration 030 during admin bootstrap', async () => {
    const mockDb: DatabaseClient = {
      async query<T = unknown>(sql: string): Promise<{ rows: T[] }> {
        if (sql.includes('FROM admin_roles')) {
          return { rows: [{ id: 'role-super-admin', code: 'super_admin' }] as T[] };
        }
        if (sql.includes('FROM users WHERE phone_e164')) {
          return { rows: [] };
        }
        if (sql.includes('SELECT COUNT(*) AS count FROM admin_users WHERE status = \'active\'')) {
          // Already 2 active operators
          return { rows: [{ count: '2' }] as T[] };
        }
        return { rows: [] };
      },
      async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
        return fn(mockDb);
      },
    };

    await expect(
      bootstrapAdminOperator(mockDb, {
        phone: '+923009998877',
        password: 'ValidComplexAdminPassword2026!',
      }),
    ).rejects.toThrow(/N5_ADMIN_OPERATOR_LIMIT_REACHED/);
  });

  it('successfully creates an active admin operator with bcrypt hash when under limit', async () => {
    let savedHash: string | undefined;

    const mockDb: DatabaseClient = {
      async query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
        if (sql.includes('FROM admin_roles')) {
          return { rows: [{ id: 'role-super-admin', code: 'super_admin' }] as T[] };
        }
        if (sql.includes('FROM users WHERE phone_e164')) {
          return { rows: [] };
        }
        if (sql.includes('SELECT COUNT(*) AS count FROM admin_users WHERE status = \'active\'')) {
          // 0 active operators currently
          return { rows: [{ count: '0' }] as T[] };
        }
        if (sql.includes('INSERT INTO users')) {
          savedHash = params?.[2] as string;
          return { rows: [] };
        }
        return { rows: [] };
      },
      async transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T> {
        return fn(mockDb);
      },
    };

    const result = await bootstrapAdminOperator(mockDb, {
      phone: '+923001234567',
      password: 'StrongCustomPassword2026!#',
      name: 'Primary Operator',
    });

    expect(result.phone).toBe('+923001234567');
    expect(result.role).toBe('super_admin');
    expect(result.createdNewUser).toBe(true);
    expect(savedHash).toBeDefined();
    expect(savedHash).toMatch(/^\$2[aby]\$\d+\$/); // Valid bcrypt hash
  });
});
