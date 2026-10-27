import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import type { DatabaseClient } from './database.types.js';

export function resolveDefaultMigrationsDir(): string {
  if (process.env.MIGRATIONS_DIR) {
    return resolve(process.env.MIGRATIONS_DIR);
  }
  const cwdDirect = resolve(process.cwd(), 'database', 'migrations');
  if (existsSync(cwdDirect)) {
    return cwdDirect;
  }
  const cwdSibling = resolve(process.cwd(), '..', 'database', 'migrations');
  if (existsSync(cwdSibling)) {
    return cwdSibling;
  }
  return cwdSibling;
}

export const MIGRATION_ADVISORY_LOCK_ID = 14592034;

export interface MigrationFile {
  name: string;
  path: string;
  number: number;
  checksum: string;
}

export interface MigrationRecord {
  id: number;
  name: string;
  applied_at: string;
  checksum: string | null;
  execution_time_ms: number;
}

export interface MigrationOptions {
  migrationsDir?: string;
  logger?: (msg: string) => void;
  dryRun?: boolean;
}

export interface MigrationResult {
  success: boolean;
  applied: string[];
  total: number;
  pendingCount: number;
  durationMs: number;
}

export interface MigrationStatusItem {
  number: number;
  name: string;
  applied: boolean;
  appliedAt?: string;
}

export function computeChecksum(content: string): string {
  return createHash('sha256').update(content.trim(), 'utf8').digest('hex');
}

export function getMigrationFiles(migrationsDir: string): MigrationFile[] {
  const resolvedDir = resolve(migrationsDir);
  const files = readdirSync(resolvedDir)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort((a, b) => {
      const numA = Number(a.split('_', 1)[0]);
      const numB = Number(b.split('_', 1)[0]);
      return numA - numB;
    });

  return files.map((name) => {
    const fullPath = join(resolvedDir, name);
    const content = readFileSync(fullPath, 'utf8');
    const number = Number(name.split('_', 1)[0]);
    return {
      name,
      path: fullPath,
      number,
      checksum: computeChecksum(content),
    };
  });
}

export async function ensureMigrationsTable(client: DatabaseClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      checksum TEXT,
      execution_time_ms INT NOT NULL DEFAULT 0
    );
  `);
}

export async function acquireMigrationLock(client: DatabaseClient): Promise<boolean> {
  const res = await client.query<{ acquired: boolean }>(
    'SELECT pg_try_advisory_lock($1) AS acquired;',
    [MIGRATION_ADVISORY_LOCK_ID],
  );
  return Boolean(res.rows[0]?.acquired);
}

export async function releaseMigrationLock(client: DatabaseClient): Promise<boolean> {
  const res = await client.query<{ released: boolean }>(
    'SELECT pg_advisory_unlock($1) AS released;',
    [MIGRATION_ADVISORY_LOCK_ID],
  );
  return Boolean(res.rows[0]?.released);
}

export async function getAppliedMigrationNames(client: DatabaseClient): Promise<Set<string>> {
  await ensureMigrationsTable(client);
  const res = await client.query<{ name: string }>('SELECT name FROM schema_migrations ORDER BY id ASC;');
  return new Set(res.rows.map((r) => r.name));
}

/**
 * Handle upgrade for pre-existing databases that were populated before
 * schema_migrations tracking was created (e.g. initial Docker volume boot).
 * Automatically marks pre-existing baseline migrations up to 033 as baselined
 * if core tables already exist.
 */
export async function baselineExistingDatabaseIfNeeded(
  client: DatabaseClient,
  files: MigrationFile[],
  logger?: (msg: string) => void,
): Promise<string[]> {
  const applied = await getAppliedMigrationNames(client);
  if (applied.size > 0) {
    return [];
  }

  // Check if core database tables (users, wallet_accounts) already exist
  const tableCheck = await client.query<{ exists: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    ) AS "exists";
  `);

  if (!tableCheck.rows[0]?.exists) {
    // Empty database; no baseline needed, all migrations will run clean from 001
    return [];
  }

  // Existing database without migration tracking. Baseline historical migrations (001 to 033).
  const baselined: string[] = [];
  const historicalFiles = files.filter((f) => f.number <= 33);

  for (const f of historicalFiles) {
    await client.query(
      `INSERT INTO schema_migrations (name, checksum, execution_time_ms)
       VALUES ($1, $2, 0)
       ON CONFLICT (name) DO NOTHING;`,
      [f.name, f.checksum],
    );
    baselined.push(f.name);
  }

  logger?.(`[MIGRATION BASELINE] Synchronized ${baselined.length} existing migrations into schema_migrations.`);
  return baselined;
}

export async function runMigrations(
  client: DatabaseClient,
  options: MigrationOptions = {},
): Promise<MigrationResult> {
  const log = options.logger ?? console.log;
  const migrationsDir = options.migrationsDir ?? resolveDefaultMigrationsDir();
  const startTime = Date.now();

  const lockAcquired = await acquireMigrationLock(client);
  if (!lockAcquired) {
    throw new Error('MIGRATION_CONCURRENCY_ERROR: Another migration runner holds the advisory lock (14592034). Aborting concurrent run.');
  }

  try {
    await ensureMigrationsTable(client);
    const files = getMigrationFiles(migrationsDir);
    await baselineExistingDatabaseIfNeeded(client, files, log);

    const appliedSet = await getAppliedMigrationNames(client);
    const pending = files.filter((f) => !appliedSet.has(f.name));

    if (pending.length === 0) {
      log(`[MIGRATION] Database is up to date (${appliedSet.size}/${files.length} migrations applied).`);
      return {
        success: true,
        applied: [],
        total: files.length,
        pendingCount: 0,
        durationMs: Date.now() - startTime,
      };
    }

    log(`[MIGRATION] Found ${pending.length} pending migration(s) out of ${files.length} total.`);

    if (options.dryRun) {
      log(`[MIGRATION DRY-RUN] Would apply: ${pending.map((p) => p.name).join(', ')}`);
      return {
        success: true,
        applied: [],
        total: files.length,
        pendingCount: pending.length,
        durationMs: Date.now() - startTime,
      };
    }

    const newlyApplied: string[] = [];

    for (const file of pending) {
      log(`[MIGRATION APPLYING] ${file.name}...`);
      const fileContent = readFileSync(file.path, 'utf8');
      const stepStart = Date.now();

      try {
        await client.transaction(async (tx) => {
          await tx.query(fileContent);
          const stepDuration = Date.now() - stepStart;
          await tx.query(
            `INSERT INTO schema_migrations (name, checksum, execution_time_ms)
             VALUES ($1, $2, $3);`,
            [file.name, file.checksum, stepDuration],
          );
        });

        newlyApplied.push(file.name);
        log(`[MIGRATION SUCCESS] ${file.name} (${Date.now() - stepStart}ms)`);
      } catch (error: any) {
        const errorDetail = `[MIGRATION FAILURE] Migration "${file.name}" failed: ${error.message}`;
        log(errorDetail);
        throw new Error(errorDetail);
      }
    }

    const durationMs = Date.now() - startTime;
    log(`[MIGRATION COMPLETE] Successfully applied ${newlyApplied.length} migration(s) in ${durationMs}ms.`);

    return {
      success: true,
      applied: newlyApplied,
      total: files.length,
      pendingCount: 0,
      durationMs,
    };
  } finally {
    await releaseMigrationLock(client).catch(() => {});
  }
}

export async function getMigrationStatus(
  client: DatabaseClient,
  migrationsDir?: string,
): Promise<MigrationStatusItem[]> {
  const dir = migrationsDir ?? resolveDefaultMigrationsDir();
  await ensureMigrationsTable(client);
  const files = getMigrationFiles(dir);

  const res = await client.query<MigrationRecord>(
    'SELECT name, applied_at, execution_time_ms FROM schema_migrations ORDER BY id ASC;',
  );
  const recordMap = new Map(res.rows.map((r) => [r.name, r]));

  return files.map((f) => {
    const record = recordMap.get(f.name);
    return {
      number: f.number,
      name: f.name,
      applied: Boolean(record),
      appliedAt: record?.applied_at,
    };
  });
}
