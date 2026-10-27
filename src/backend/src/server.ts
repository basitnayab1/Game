import type { Server } from 'node:http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import {
  createDatabaseClient,
  checkDatabaseHealth,
  type ConnectedDatabaseClient,
} from './core/database/postgres.client.js';
import { runMigrations } from './core/database/migrator.js';
import type { DatabaseClient } from './core/database/database.types.js';
import { recoverDanglingCrashRounds } from './modules/games/crash-game.controller.js';

export interface StartServerOptions {
  db?: ConnectedDatabaseClient | DatabaseClient;
  port?: number;
  nodeEnv?: string;
  databaseUrl?: string;
  autoMigrate?: boolean;
}

export interface RunningServer {
  app: ReturnType<typeof createApp>;
  server: Server;
  db?: ConnectedDatabaseClient | DatabaseClient;
  close: () => Promise<void>;
}

export async function startServer(options: StartServerOptions = {}): Promise<RunningServer> {
  const currentEnv = options.nodeEnv ?? env.NODE_ENV;
  const isProtectedEnv = currentEnv === 'production' || currentEnv === 'staging';
  const dbUrl = options.databaseUrl ?? env.DATABASE_URL;

  let dbClient: ConnectedDatabaseClient | DatabaseClient | undefined = options.db;

  if (!dbClient) {
    if (dbUrl) {
      const candidate = createDatabaseClient(dbUrl);
      try {
        const health = await checkDatabaseHealth(candidate, 5000);
        if (health.ok) {
          dbClient = candidate;
          console.log(`[DATABASE] PostgreSQL connected successfully in ${currentEnv}.`);
        } else {
          await candidate.close().catch(() => {});
          const errorMsg = `[DATABASE] PostgreSQL health check failed during ${currentEnv} startup.`;
          if (isProtectedEnv) {
            throw new Error(errorMsg);
          }
          console.warn(`${errorMsg} Continuing without database in development mode.`);
        }
      } catch (error) {
        await candidate.close().catch(() => {});
        const errorMsg = `[DATABASE] Failed to connect to database during ${currentEnv} startup: ${error instanceof Error ? error.message : String(error)}`;
        if (isProtectedEnv) {
          throw new Error(errorMsg);
        }
        console.warn(`${errorMsg} Continuing without database in development mode.`);
      }
    } else if (isProtectedEnv) {
      throw new Error(`[DATABASE] DATABASE_URL is required for ${currentEnv} startup.`);
    }
  }

  if (dbClient && (options.autoMigrate || process.env.AUTO_MIGRATE === 'true')) {
    try {
      console.log(`[MIGRATION] Checking database migrations on startup...`);
      const migResult = await runMigrations(dbClient, {
        logger: (msg) => console.log(msg),
      });
      console.log(`[MIGRATION] Startup migrations verified (${migResult.applied.length} applied, ${migResult.total} total).`);
    } catch (err: any) {
      console.error(`[MIGRATION FATAL] Startup migration check failed: ${err.message}`);
      if (isProtectedEnv) {
        throw err;
      }
    }
  }

  if (dbClient) {
    try {
      const recovered = await recoverDanglingCrashRounds(dbClient);
      if (recovered > 0) {
        console.log(`[RECOVERY] Cleaned up ${recovered} dangling active crash round(s) on startup.`);
      }
    } catch (err: any) {
      console.warn(`[RECOVERY] Warning: Crash round recovery check skipped: ${err.message}`);
    }
  }

  const app = createApp(dbClient);
  const port = options.port ?? env.PORT;

  return new Promise<RunningServer>((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`${env.APP_NAME} backend listening on port ${port} (${currentEnv})`);
      resolve({
        app,
        server,
        db: dbClient,
        close: async () => {
          await new Promise<void>((res) => server.close(() => res()));
          if (dbClient && 'close' in dbClient && typeof (dbClient as any).close === 'function') {
            await (dbClient as ConnectedDatabaseClient).close().catch(() => {});
          }
        },
      });
    });

    server.on('error', (err) => {
      if (dbClient && 'close' in dbClient && typeof (dbClient as any).close === 'function') {
        (dbClient as ConnectedDatabaseClient).close().catch(() => {});
      }
      reject(err);
    });
  });
}

// Auto-start server in non-test mode
if (env.NODE_ENV !== 'test') {
  startServer().then((running) => {
    const shutdown = async (signal: string) => {
      console.log(`[SERVER] Received ${signal}. Shutting down gracefully...`);
      try {
        await running.close();
        console.log('[SERVER] Graceful shutdown complete.');
        process.exit(0);
      } catch (err) {
        console.error('[SERVER] Error during shutdown:', err);
        process.exit(1);
      }
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }).catch((err) => {
    console.error('[CRITICAL] Startup failed:', err);
    process.exit(1);
  });
}
