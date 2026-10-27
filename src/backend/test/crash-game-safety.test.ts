import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import { createDatabaseClient, type ConnectedDatabaseClient } from '../src/core/database/postgres.client.js';
import {
  placeCrashBet,
  cashoutCrashBet,
  getCrashRoundStatus,
  verifyCrashFairnessController,
  calculateProvablyFairCrashPoint,
  calculateMultiplierAtElapsed,
  recoverDanglingCrashRounds,
} from '../src/modules/games/crash-game.controller.js';
import {
  spinGameController,
  claimTestBalanceController,
} from '../src/modules/games/game-play.controller.js';

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testSecret123@localhost:54328/n5_idempotency_test';

function createMockResponse() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: any) {
      res.body = data;
      return res;
    },
  };
  return res;
}

describe('Crash Game & Game Controller Safety Suite', () => {
  // --------------------------------------------------------------------------
  // SECTION 1: Provably Fair Mathematical Guarantees (Offline / Unit)
  // --------------------------------------------------------------------------
  describe('Provably Fair Mathematical Guarantees', () => {
    it('generates deterministic crash points from HMAC-SHA256 without Math.random dependency', () => {
      const serverSeed = 'b1946ac92492d2347c6235b4d2611184';
      const clientSeed = 'testClientSeed123';
      const nonce = 42;

      const crash1 = calculateProvablyFairCrashPoint(serverSeed, clientSeed, nonce);
      const crash2 = calculateProvablyFairCrashPoint(serverSeed, clientSeed, nonce);

      expect(crash1).toBe(crash2);
      expect(typeof crash1).toBe('number');
      expect(crash1).toBeGreaterThanOrEqual(1.00);
      expect(crash1).toBeLessThanOrEqual(1000.00);
    });

    it('verifies SHA256 commitment hash and public mathematical verification endpoint', async () => {
      const serverSeed = crypto.randomBytes(32).toString('hex');
      const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
      const clientSeed = 'playerCustomSeed';
      const nonce = 5;

      const expectedCrash = calculateProvablyFairCrashPoint(serverSeed, clientSeed, nonce);

      // Verify endpoint with valid matching hash
      const reqValid: any = {
        body: {
          serverSeed,
          clientSeed,
          nonce,
          claimedHash: serverSeedHash,
        },
      };
      const resValid = createMockResponse();
      await verifyCrashFairnessController(reqValid as Request, resValid as Response);

      expect(resValid.statusCode).toBe(200);
      expect(resValid.body?.ok).toBe(true);
      expect(resValid.body?.data?.verified).toBe(true);
      expect(resValid.body?.data?.calculatedHash).toBe(serverSeedHash);
      expect(resValid.body?.data?.crashPoint).toBe(expectedCrash);

      // Verify endpoint with tampered hash
      const reqTampered: any = {
        body: {
          serverSeed,
          clientSeed,
          nonce,
          claimedHash: 'tampered_hash_00000000000000000000000000000000000000000000000000000000',
        },
      };
      const resTampered = createMockResponse();
      await verifyCrashFairnessController(reqTampered as Request, resTampered as Response);

      expect(resTampered.body?.data?.verified).toBe(false);
    });

    it('calculates server-authoritative flight curve accurately as a function of elapsed time', () => {
      expect(calculateMultiplierAtElapsed(0)).toBe(1.00);
      const multAt1Sec = calculateMultiplierAtElapsed(1);
      expect(multAt1Sec).toBeGreaterThan(1.5);
      const multAt5Sec = calculateMultiplierAtElapsed(5);
      expect(multAt5Sec).toBeGreaterThan(multAt1Sec);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 2: Demo Faucet & Account Restriction Unit Safety
  // --------------------------------------------------------------------------
  describe('Demo Faucet & Account Restriction Safety', () => {
    it('strictly forbids demo faucet in production environment', async () => {
      const oldEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        const req: any = {
          auth: { userId: 'any-user' },
          app: { locals: {} },
        };
        const res = createMockResponse();
        await claimTestBalanceController(req as Request, res as Response);

        expect(res.statusCode).toBe(403);
        expect(res.body?.ok).toBe(false);
        expect(res.body?.error?.code).toBe('DEMO_FAUCET_DISABLED');
      } finally {
        process.env.NODE_ENV = oldEnv;
      }
    });

    it('rejects invalid bet amounts (below minimum, above maximum, negative, non-integer)', async () => {
      const invalidBets = [0, -500, 999, 500001, NaN, 'abc', 100.5];

      for (const betMinor of invalidBets) {
        const req: any = {
          auth: { userId: 'unit-user-1' },
          body: { betMinor },
          app: { locals: {} },
          header: () => null,
        };
        const res = createMockResponse();
        await placeCrashBet(req as Request, res as Response);

        expect(res.statusCode).toBe(400);
        expect(res.body?.ok).toBe(false);
        expect(res.body?.error?.code).toBe('INVALID_BET_AMOUNT');
      }
    });

    it('fails closed with 503 when no database is configured', async () => {
      const betReq: any = { auth: { userId: 'no-db-player' }, body: { betMinor: 5000 }, app: { locals: {} }, header: () => null };
      const betRes = createMockResponse();
      await placeCrashBet(betReq as Request, betRes as Response);
      expect(betRes.statusCode).toBe(503);
      expect(betRes.body?.error?.code).toBe('GAME_STORE_UNAVAILABLE');

      const cashReq: any = { auth: { userId: 'no-db-player' }, body: { roundId: crypto.randomUUID() }, app: { locals: {} } };
      const cashRes = createMockResponse();
      await cashoutCrashBet(cashReq as Request, cashRes as Response);
      expect(cashRes.statusCode).toBe(503);
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 3: Live Database Concurrency, Row Locks & Persistence Integration
  // --------------------------------------------------------------------------
  describe('PostgreSQL Durable Concurrency, Atomic Settlement & Restart Integration', () => {
    let db: ConnectedDatabaseClient | undefined;
    let isDbAvailable = false;
    let userAId: string;
    let userBId: string;
    let suspendedUserId: string;
    let walletAId: string;
    let activeSessionId: string;
    let expiredSessionId: string;

    beforeAll(async () => {
      try {
        db = createDatabaseClient(TEST_DB_URL);
        await db.query('SELECT 1');
        isDbAvailable = true;
      } catch {
        console.warn(`[INFO] PostgreSQL test container not running at ${TEST_DB_URL}. Skipping live DB integration.`);
        return;
      }

      // Seed test users
      userAId = crypto.randomUUID();
      userBId = crypto.randomUUID();
      suspendedUserId = crypto.randomUUID();

      await db.query(
        `INSERT INTO users (id, phone_e164, date_of_birth, password_hash, status)
         VALUES ($1, '+923001110001', '1990-01-01', 'hash', 'active'),
                ($2, '+923001110002', '1990-01-01', 'hash', 'active'),
                ($3, '+923001110003', '1990-01-01', 'hash', 'suspended')
         ON CONFLICT (id) DO NOTHING`,
        [userAId, userBId, suspendedUserId]
      );

      // Seed wallet for user A with PKR 1,000 (100,000 minor)
      const wRes = await db.query<{ id: string }>(
        `INSERT INTO wallet_accounts (user_id, currency, available_minor, locked_minor)
         VALUES ($1, 'PKR', 100000, 0)
         RETURNING id`,
        [userAId]
      );
      walletAId = wRes.rows[0].id;

      // Seed game session for User A
      activeSessionId = crypto.randomUUID();
      expiredSessionId = crypto.randomUUID();

      // Find an active game in games catalog or create one
      let gameRow = (await db.query<{ id: string }>('SELECT id FROM games WHERE status = \'active\' LIMIT 1')).rows[0];
      if (!gameRow) {
        const provRes = await db.query<{ id: string }>(
          `INSERT INTO game_providers (id, external_provider_id, name, status)
           VALUES (gen_random_uuid(), 'test_prov', 'Test Provider', 'active')
           ON CONFLICT DO NOTHING RETURNING id`
        );
        const provId = provRes.rows[0]?.id || (await db.query<{ id: string }>('SELECT id FROM game_providers LIMIT 1')).rows[0].id;
        const gRes = await db.query<{ id: string }>(
          `INSERT INTO games (id, provider_id, external_game_id, name, category, status)
           VALUES (gen_random_uuid(), $1, 'aviator_crash', 'Aviator Crash', 'crash', 'active')
           RETURNING id`,
          [provId]
        );
        gameRow = gRes.rows[0];
      }

      await db.query(
        `INSERT INTO game_sessions (id, user_id, game_id, provider_session_id, status, expires_at)
         VALUES ($1, $2, $3, 'sess_active', 'active', now() + INTERVAL '1 hour'),
                ($4, $2, $3, 'sess_expired', 'active', now() - INTERVAL '1 hour')`,
        [activeSessionId, userAId, gameRow.id, expiredSessionId]
      );
    });

    beforeEach((ctx) => {
      if (!isDbAvailable) {
        ctx.skip();
      }
    });

    afterAll(async () => {
      if (!db || !isDbAvailable) return;
      try {
        await db.query('DELETE FROM crash_game_rounds WHERE user_id IN ($1, $2, $3)', [userAId, userBId, suspendedUserId]);
        await db.query('DELETE FROM ledger_entries WHERE wallet_account_id = $1', [walletAId]);
        await db.query('DELETE FROM game_sessions WHERE user_id IN ($1, $2, $3)', [userAId, userBId, suspendedUserId]);
        await db.query('DELETE FROM wallet_accounts WHERE user_id IN ($1, $2, $3)', [userAId, userBId, suspendedUserId]);
        await db.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [userAId, userBId, suspendedUserId]);
      } catch (_) {}
      await db.close().catch(() => {});
    });

    it('rejects bet when user status is suspended (ACCOUNT_RESTRICTED)', async () => {
      const req: any = {
        auth: { userId: suspendedUserId },
        body: { betMinor: 2000 },
        app: { locals: { db } },
        header: () => null,
      };
      const res = createMockResponse();
      await placeCrashBet(req as Request, res as Response);

      expect(res.statusCode).toBe(403);
      expect(res.body?.ok).toBe(false);
      expect(res.body?.error?.code).toBe('ACCOUNT_RESTRICTED');
    });

    it('rejects bet when game session is expired', async () => {
      const req: any = {
        auth: { userId: userAId },
        body: { betMinor: 2000, sessionId: expiredSessionId },
        app: { locals: { db } },
        header: () => null,
      };
      const res = createMockResponse();
      await placeCrashBet(req as Request, res as Response);

      expect(res.statusCode).toBe(403);
      expect(res.body?.ok).toBe(false);
      expect(res.body?.error?.code).toBe('SESSION_EXPIRED');
    });

    it('places bet atomically, debits wallet, creates ledger entry, and persists durable round', async () => {
      const betMinor = 5000; // PKR 50
      const idempotencyKey = `bet_idemp_${Date.now()}`;

      const req: any = {
        auth: { userId: userAId },
        body: { betMinor, sessionId: activeSessionId, idempotencyKey },
        app: { locals: { db } },
        header: () => null,
      };
      const res = createMockResponse();
      await placeCrashBet(req as Request, res as Response);

      expect(res.statusCode).toBe(200);
      expect(res.body?.ok).toBe(true);
      expect(res.body?.data?.roundId).toBeDefined();
      expect(res.body?.data?.crashHash).toBeDefined();
      expect(res.body?.data?.status).toBe('active');
      expect(res.body?.data?.newBalanceMinor).toBe(95000); // 100000 - 5000

      const roundId = res.body?.data?.roundId;

      // Verify DB row exists in crash_game_rounds
      const dbRound = (await db!.query<{ id: string; status: string; bet_minor: string }>(
        'SELECT id, status, bet_minor FROM crash_game_rounds WHERE id = $1',
        [roundId]
      )).rows[0];

      expect(dbRound).toBeDefined();
      expect(dbRound.status).toBe('active');
      expect(Number(dbRound.bet_minor)).toBe(betMinor);

      // Verify ledger entry exists
      const ledger = (await db!.query<{ id: string; entry_type: string; direction: string }>(
        `SELECT id, entry_type, direction FROM ledger_entries WHERE reference_id = $1`,
        [roundId]
      )).rows[0];

      expect(ledger).toBeDefined();
      expect(ledger.entry_type).toBe('game_bet');
      expect(ledger.direction).toBe('debit');

      // -------------------------------------------------------------
      // Duplicate Bet with same idempotency key returns replayed round
      // -------------------------------------------------------------
      const resDup = createMockResponse();
      await placeCrashBet(req as Request, resDup as Response);

      expect(resDup.statusCode).toBe(200);
      expect(resDup.body?.data?.roundId).toBe(roundId);
      expect(resDup.body?.data?.replayed).toBe(true);

      // Wallet was NOT debited a second time
      const walletAfter = (await db!.query<{ available_minor: string }>(
        'SELECT available_minor FROM wallet_accounts WHERE id = $1',
        [walletAId]
      )).rows[0];
      expect(Number(walletAfter.available_minor)).toBe(95000);
    });

    it('rejects starting another bet while an active round is already in progress', async () => {
      // User A still has the active round from the previous test
      const req: any = {
        auth: { userId: userAId },
        body: { betMinor: 2000 },
        app: { locals: { db } },
        header: () => null,
      };
      const res = createMockResponse();
      await placeCrashBet(req as Request, res as Response);

      expect(res.statusCode).toBe(409);
      expect(res.body?.ok).toBe(false);
      expect(res.body?.error?.code).toBe('ACTIVE_ROUND_EXISTS');
    });

    it('prevents double-credit during simultaneous / concurrent cashout requests', async () => {
      // Find the active round
      const activeRound = (await db!.query<{ id: string }>(
        `SELECT id FROM crash_game_rounds WHERE user_id = $1 AND status = 'active' LIMIT 1`,
        [userAId]
      )).rows[0];
      expect(activeRound).toBeDefined();

      // The placed round has a random crash point (1 in 33 crash instantly at 1.00x);
      // pin it high so this test exercises the double-credit guard, not the RNG.
      await db!.query(`UPDATE crash_game_rounds SET crash_point = 100.00 WHERE id = $1`, [activeRound.id]);

      const balanceBefore = Number((await db!.query<{ available_minor: string }>(
        'SELECT available_minor FROM wallet_accounts WHERE id = $1',
        [walletAId]
      )).rows[0].available_minor);

      // Fire 2 simultaneous cashout requests for the exact same round
      const req1: any = {
        auth: { userId: userAId },
        body: { roundId: activeRound.id },
        app: { locals: { db } },
      };
      const req2: any = {
        auth: { userId: userAId },
        body: { roundId: activeRound.id },
        app: { locals: { db } },
      };

      const res1 = createMockResponse();
      const res2 = createMockResponse();

      await Promise.all([
        cashoutCrashBet(req1 as Request, res1 as Response),
        cashoutCrashBet(req2 as Request, res2 as Response),
      ]);

      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);

      const oneWon = res1.body?.data?.won || res2.body?.data?.won;
      expect(oneWon).toBe(true);

      // One must be fresh, the other must have replayed: true
      const hasReplayed = res1.body?.data?.replayed === true || res2.body?.data?.replayed === true;
      expect(hasReplayed).toBe(true);

      // Verify wallet was only credited EXACTLY ONCE
      const balanceAfter = Number((await db!.query<{ available_minor: string }>(
        'SELECT available_minor FROM wallet_accounts WHERE id = $1',
        [walletAId]
      )).rows[0].available_minor);

      const winAmount = res1.body?.data?.winMinor || res2.body?.data?.winMinor;
      expect(balanceAfter).toBe(balanceBefore + winAmount);

      // Verify exactly ONE game_win ledger entry exists for this round
      const winLedgers = (await db!.query<{ id: string }>(
        `SELECT id FROM ledger_entries WHERE reference_id = $1 AND entry_type = 'game_win'`,
        [activeRound.id]
      )).rows;
      expect(winLedgers.length).toBe(1);
    });

    it('recovers dangling active crash rounds on server restart', async () => {
      // Insert a dangling active round started 2 minutes ago
      const danglingRoundId = crypto.randomUUID();
      await db!.query(
        `INSERT INTO crash_game_rounds (
           id, user_id, wallet_account_id, bet_minor, crash_point,
           server_seed, server_seed_hash, client_seed, nonce, status, started_at
         ) VALUES ($1, $2, $3, 2000, 3.50, 'seed', 'hash', 'cseed', 99, 'active', now() - INTERVAL '120 seconds')`,
        [danglingRoundId, userBId, walletAId]
      );

      // Invoke restart recovery
      const recoveredCount = await recoverDanglingCrashRounds(db!, 60);
      expect(recoveredCount).toBeGreaterThanOrEqual(1);

      // Verify the dangling round was transitioned to 'crashed'
      const recoveredRound = (await db!.query<{ status: string; settled_at: string }>(
        'SELECT status, settled_at FROM crash_game_rounds WHERE id = $1',
        [danglingRoundId]
      )).rows[0];

      expect(recoveredRound.status).toBe('crashed');
      expect(recoveredRound.settled_at).toBeDefined();
    });

    async function insertActiveRound(ownerId: string, crashPoint: number, startedAgoMs: number, serverSeed = 'serverSeed123') {
      const roundId = crypto.randomUUID();
      await db!.query(
        `INSERT INTO crash_game_rounds (id, user_id, wallet_account_id, bet_minor, crash_point, server_seed, server_seed_hash, client_seed, nonce, status, started_at)
         VALUES ($1, $2, $3, 10000, $4, $5, 'hash', 'cseed', 1, 'active', now() - ($6::text || ' milliseconds')::interval)`,
        [roundId, ownerId, walletAId, crashPoint, serverSeed, String(startedAgoMs)]
      );
      return roundId;
    }

    it('caps client-supplied multiplier to server-authoritative multiplier on early cashout', async () => {
      const roundId = await insertActiveRound(userAId, 10.0, 0);

      // Malicious client claims 500x multiplier immediately
      const req: any = { auth: { userId: userAId }, body: { roundId, multiplier: 500.0 }, app: { locals: { db } } };
      const res = createMockResponse();
      await cashoutCrashBet(req as Request, res as Response);

      expect(res.statusCode).toBe(200);
      expect(res.body?.data?.won).toBe(true);
      // Multiplier must be capped to server-authoritative value (~1.00x), NOT 500x!
      expect(res.body?.data?.multiplier).toBeLessThan(1.5);
      expect(res.body?.data?.winMinor).toBeLessThan(15000);
    });

    it('rejects cashout by a different user with ROUND_FORBIDDEN (Round Ownership)', async () => {
      const roundId = await insertActiveRound(userAId, 5.0, 0);

      const req: any = { auth: { userId: userBId }, body: { roundId }, app: { locals: { db } } };
      const res = createMockResponse();
      await cashoutCrashBet(req as Request, res as Response);

      expect(res.statusCode).toBe(403);
      expect(res.body?.error?.code).toBe('ROUND_FORBIDDEN');
      await db!.query(`UPDATE crash_game_rounds SET status = 'crashed', settled_at = now() WHERE id = $1`, [roundId]);
    });

    it('marks round as crashed if cashed out after plane has crashed (Late Cashout)', async () => {
      // Crash point 1.20x, started 10 seconds ago: the server multiplier is already past it.
      const roundId = await insertActiveRound(userAId, 1.2, 10000, 'revealed_server_seed_999');

      const req: any = { auth: { userId: userAId }, body: { roundId }, app: { locals: { db } } };
      const res = createMockResponse();
      await cashoutCrashBet(req as Request, res as Response);

      expect(res.statusCode).toBe(200);
      expect(res.body?.data?.won).toBe(false);
      expect(res.body?.data?.crashed).toBe(true);
      expect(Number(res.body?.data?.crashPoint)).toBe(1.2);
      expect(res.body?.data?.serverSeed).toBe('revealed_server_seed_999');
    });

    it('enforces account restrictions on slot machine spin', async () => {
      const req: any = {
        auth: { userId: suspendedUserId },
        body: { betMinor: 1000 },
        app: { locals: { db } },
      };
      const res = createMockResponse();
      await spinGameController(req as Request, res as Response);

      expect(res.statusCode).toBe(403);
      expect(res.body?.ok).toBe(false);
      expect(res.body?.error?.code).toBe('ACCOUNT_RESTRICTED');
    });

    it('rejects invalid bet amounts on slot machine spin', async () => {
      const req: any = {
        auth: { userId: userAId },
        body: { betMinor: 50 }, // below 100
        app: { locals: { db } },
      };
      const res = createMockResponse();
      await spinGameController(req as Request, res as Response);

      expect(res.statusCode).toBe(400);
      expect(res.body?.ok).toBe(false);
      expect(res.body?.error?.code).toBe('INVALID_BET_AMOUNT');
    });

    it('executes slot spin atomically, debits wallet, logs ledger, and generates CSPRNG reels', async () => {
      const balanceBefore = Number((await db!.query<{ available_minor: string }>(
        'SELECT available_minor FROM wallet_accounts WHERE id = $1',
        [walletAId]
      )).rows[0].available_minor);

      const betMinor = 1000; // PKR 10
      const req: any = {
        auth: { userId: userAId },
        body: { betMinor },
        app: { locals: { db } },
      };
      const res = createMockResponse();
      await spinGameController(req as Request, res as Response);

      expect(res.statusCode).toBe(200);
      expect(res.body?.ok).toBe(true);
      expect(res.body?.data?.reels?.length).toBe(3);
      expect(typeof res.body?.data?.winMinor).toBe('number');

      const balanceAfter = Number((await db!.query<{ available_minor: string }>(
        'SELECT available_minor FROM wallet_accounts WHERE id = $1',
        [walletAId]
      )).rows[0].available_minor);

      expect(balanceAfter).toBe(balanceBefore - betMinor + res.body?.data?.winMinor);
    });
  });
});
