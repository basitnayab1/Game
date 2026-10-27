import { resolve, join } from 'node:path';
import { env } from '../config/env.js';
import { createDatabaseClient } from '../core/database/postgres.client.js';
import { runMigrations, getMigrationStatus, resolveDefaultMigrationsDir } from '../core/database/migrator.js';

async function main() {
  const args = process.argv.slice(2);
  const isStatus = args.includes('--status') || args.includes('--check');
  const isDryRun = args.includes('--dry-run');

  const urlArg = args.find((a) => a.startsWith('--url='));
  const dbUrl = urlArg ? urlArg.split('=', 2)[1] : env.DATABASE_URL;

  if (!dbUrl) {
    console.error('[MIGRATOR ERROR] DATABASE_URL is not set and no --url argument was provided.');
    process.exit(1);
  }

  const migrationsDir = resolveDefaultMigrationsDir();
  const client = createDatabaseClient(dbUrl);

  try {
    if (isStatus) {
      console.log(`Checking migration status using directory: ${migrationsDir}`);
      const statusList = await getMigrationStatus(client, migrationsDir);
      console.table(
        statusList.map((s) => ({
          '#': s.number,
          Migration: s.name,
          Status: s.applied ? 'APPLIED' : 'PENDING',
          'Applied At': s.appliedAt ?? '-',
        })),
      );
      const pending = statusList.filter((s) => !s.applied).length;
      console.log(`Summary: ${statusList.length - pending}/${statusList.length} applied, ${pending} pending.`);
      return;
    }

    console.log(`[MIGRATOR] Starting migration run against database...`);
    const result = await runMigrations(client, {
      migrationsDir,
      dryRun: isDryRun,
      logger: (msg) => console.log(msg),
    });

    console.log(`[MIGRATOR] Finished. Applied ${result.applied.length} migration(s).`);
  } catch (error: any) {
    console.error(`[MIGRATOR FATAL] Migration failed:`, error.message);
    process.exit(1);
  } finally {
    await client.close().catch(() => {});
  }
}

main().catch((err) => {
  console.error('[MIGRATOR UNCAUGHT]', err);
  process.exit(1);
});
