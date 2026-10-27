import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { createDatabaseClient, type ConnectedDatabaseClient } from '../src/core/database/postgres.client.js';
import { signAccessToken } from '../src/utils/tokens.js';
import { clearProviders, registerProvider } from '../src/modules/games/provider.registry.js';
import type { ProviderAdapter } from '../src/modules/games/provider.types.js';

const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:testSecret123@localhost:54328/n5_idempotency_test';

describe('Game Integration & End-to-End Lifecycle Suite', () => {
  let db: ConnectedDatabaseClient | undefined;
  let isDbAvailable = false;
  let server: Server;
  let baseUrl: string;

  // Test Entities
  let testUserAId: string;
  let testUserBId: string;
  let testUserAPhone = '+923007771122';
  let testUserBPhone = '+923007773344';
  let testPassword = 'SecretPassword123!';
  let tokenA: string;
  let tokenB: string;

  let localCrashGameId: string;
  let localSlotGameId: string;
  let externalProviderGameId: string;
  let disabledProviderGameId: string;
  let internalProviderId: string;
  let externalProviderId: string;
  let disabledProviderId: string;

  beforeAll(async () => {
    try {
      db = createDatabaseClient(TEST_DB_URL);
      await db.query('SELECT 1');
      isDbAvailable = true;
    } catch {
      console.warn(`[INFO] PostgreSQL test container not running at ${TEST_DB_URL}. Skipping live DB integration.`);
      return;
    }

    clearProviders();

    // 1. Seed users
    testUserAId = crypto.randomUUID();
    testUserBId = crypto.randomUUID();
    testUserAPhone = `+92300${Math.floor(1000000 + Math.random() * 9000000)}`;
    testUserBPhone = `+92300${Math.floor(1000000 + Math.random() * 9000000)}`;
    const passwordHash = await bcrypt.hash(testPassword, 10);

    await db.query(
      `INSERT INTO users (id, phone_e164, date_of_birth, password_hash, status, phone_verified_at)
       VALUES ($1, $2, '1992-02-02', $3, 'active', NOW()),
              ($4, $5, '1994-04-04', $3, 'active', NOW())
       ON CONFLICT (id) DO UPDATE SET phone_verified_at = NOW()`,
      [testUserAId, testUserAPhone, passwordHash, testUserBId, testUserBPhone]
    );

    // 2. Seed wallet for User A with PKR 1,000 (100,000 minor)
    await db.query(
      `INSERT INTO wallet_accounts (user_id, currency, available_minor, locked_minor)
       VALUES ($1, 'PKR', 100000, 0),
              ($2, 'PKR', 50000, 0)
       ON CONFLICT (user_id, currency) DO UPDATE SET available_minor = EXCLUDED.available_minor`,
      [testUserAId, testUserBId]
    );

    // 3. Seed Providers:
    // - Internal N5 provider (Local games)
    // - External provider (unconfigured third-party)
    // - Disabled provider
    internalProviderId = crypto.randomUUID();
    externalProviderId = crypto.randomUUID();
    disabledProviderId = crypto.randomUUID();

    await db.query(
      `INSERT INTO game_providers (id, external_provider_id, name, status, is_authorized)
       VALUES ($1, 'internal', 'N5 Engine Internal', 'active', true),
              ($2, 'pragmatic_ext', 'Pragmatic External', 'active', true),
              ($3, 'disabled_prov', 'Disabled Provider', 'disabled', false)
       ON CONFLICT DO NOTHING`,
      [internalProviderId, externalProviderId, disabledProviderId]
    );

    // 4. Seed Games:
    // - Aviator Crash Game (Local)
    // - Gates of Olympus Slot (Local)
    // - Sweet Bonanza (External, unconfigured provider)
    // - Inactive Game on Disabled Provider
    localCrashGameId = crypto.randomUUID();
    localSlotGameId = crypto.randomUUID();
    externalProviderGameId = crypto.randomUUID();
    disabledProviderGameId = crypto.randomUUID();

    await db.query(
      `INSERT INTO games (id, provider_id, external_game_id, name, category, status)
       VALUES ($1, $2, 'aviator', 'Aviator Crash', 'crash', 'active'),
              ($3, $2, 'fruit-slot', 'Fruit Slot Machine', 'slots', 'active'),
              ($4, $5, 'sweet_bonanza_ext', 'Sweet Bonanza Live', 'live_casino', 'active'),
              ($6, $7, 'dead_game', 'Dead Game', 'table', 'active')
       ON CONFLICT DO NOTHING`,
      [
        localCrashGameId, internalProviderId,
        localSlotGameId,
        externalProviderGameId, externalProviderId,
        disabledProviderGameId, disabledProviderId,
      ]
    );

    // 5. Generate Auth Tokens and Sessions
    const userASessionId = crypto.randomUUID();
    const userBSessionId = crypto.randomUUID();
    await db.query(
      `INSERT INTO user_sessions (id, user_id, refresh_token_hash, expires_at, created_at)
       VALUES ($1, $2, 'hashA', NOW() + INTERVAL '1 day', NOW()), ($3, $4, 'hashB', NOW() + INTERVAL '1 day', NOW())
       ON CONFLICT (id) DO NOTHING`,
      [userASessionId, testUserAId, userBSessionId, testUserBId]
    );
    tokenA = signAccessToken(testUserAId, userASessionId);
    tokenB = signAccessToken(testUserBId, userBSessionId);

    // 6. Start Express server with db
    const app = createApp(db);
    server = app.listen(0);
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  beforeEach((ctx) => {
    if (!isDbAvailable) {
      ctx.skip();
    }
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((res) => server.close(() => res()));
    }
    if (db && isDbAvailable) {
      try {
        await db.query('DELETE FROM crash_game_rounds WHERE user_id IN ($1, $2)', [testUserAId, testUserBId]);
        await db.query('DELETE FROM ledger_entries WHERE wallet_account_id IN (SELECT id FROM wallet_accounts WHERE user_id IN ($1, $2))', [testUserAId, testUserBId]);
        await db.query('DELETE FROM game_sessions WHERE user_id IN ($1, $2)', [testUserAId, testUserBId]);
        await db.query('DELETE FROM recently_played_games WHERE user_id IN ($1, $2)', [testUserAId, testUserBId]);
        await db.query('DELETE FROM games WHERE id IN ($1, $2, $3, $4)', [localCrashGameId, localSlotGameId, externalProviderGameId, disabledProviderGameId]);
        await db.query('DELETE FROM game_providers WHERE id IN ($1, $2, $3)', [internalProviderId, externalProviderId, disabledProviderId]);
        await db.query('DELETE FROM wallet_accounts WHERE user_id IN ($1, $2)', [testUserAId, testUserBId]);
        await db.query('DELETE FROM user_sessions WHERE user_id IN ($1, $2)', [testUserAId, testUserBId]);
        await db.query('DELETE FROM users WHERE id IN ($1, $2)', [testUserAId, testUserBId]);
      } catch (_) {}
      await db.close().catch(() => {});
    }
    clearProviders();
  });

  // --------------------------------------------------------------------------
  // FLOW 1: Aviator Crash Game E2E
  // login → catalog → launch → bet → cashout → wallet → statement
  // --------------------------------------------------------------------------
  it('completes entire Aviator lifecycle: login → catalog → launch → bet → cashout → wallet → statement', async () => {
    // 1. Login
    const loginRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testUserAPhone, password: testPassword }),
    });
    const loginJson = await loginRes.json();
    expect(loginRes.status).toBe(200);
    expect(loginJson.accessToken).toBeDefined();
    const playerToken = loginJson.accessToken;

    // 2. Catalog
    const catalogRes = await fetch(`${baseUrl}/api/v1/games/catalog`, {
      headers: { Authorization: `Bearer ${playerToken}` },
    });
    const catalogJson = await catalogRes.json();
    expect(catalogRes.status).toBe(200);
    expect(catalogJson.ok).toBe(true);
    expect(Array.isArray(catalogJson.data)).toBe(true);

    const aviatorItem = catalogJson.data.find((g: any) => g.id === localCrashGameId || g.name.includes('Aviator'));
    expect(aviatorItem).toBeDefined();

    // 3. Launch
    const launchRes = await fetch(`${baseUrl}/api/v1/games/${localCrashGameId}/launch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${playerToken}` },
    });
    const launchJson = await launchRes.json();
    expect(launchRes.status).toBe(200);
    expect(launchJson.ok).toBe(true);
    expect(launchJson.data.isLocal).toBe(true);
    expect(launchJson.data.sessionId).toBeDefined();
    expect(launchJson.data.launchUrl).toContain('/games/aviator');
    expect(launchJson.data.launchUrl).toContain(`session=${launchJson.data.sessionId}`);

    const sessionId = launchJson.data.sessionId;

    // 4. Initial Wallet
    const walletBeforeRes = await fetch(`${baseUrl}/api/v1/wallet`, {
      headers: { Authorization: `Bearer ${playerToken}` },
    });
    const walletBeforeJson = await walletBeforeRes.json();
    expect(walletBeforeRes.status).toBe(200);
    expect(walletBeforeJson.ok).toBe(true);
    const initialBalanceMinor = walletBeforeJson.data.availableMinor;
    expect(initialBalanceMinor).toBe(100000); // PKR 1,000

    // 5. Bet Placement
    const betMinor = 5000; // PKR 50
    const betRes = await fetch(`${baseUrl}/api/v1/games/crash/bet`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${playerToken}`,
        'Content-Type': 'application/json',
        'x-game-session-id': sessionId,
      },
      body: JSON.stringify({
        betMinor,
        gameId: localCrashGameId,
        sessionId,
      }),
    });
    const betJson = await betRes.json();
    expect(betRes.status).toBe(200);
    expect(betJson.ok).toBe(true);
    expect(betJson.data.roundId).toBeDefined();
    expect(betJson.data.status).toBe('active');
    expect(betJson.data.newBalanceMinor).toBe(initialBalanceMinor - betMinor);

    const roundId = betJson.data.roundId;

    // 6. Cashout
    const cashoutRes = await fetch(`${baseUrl}/api/v1/games/crash/cashout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${playerToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        roundId,
        multiplier: 1.50,
      }),
    });
    const cashoutJson = await cashoutRes.json();
    expect(cashoutRes.status).toBe(200);
    expect(cashoutJson.ok).toBe(true);
    expect(cashoutJson.data.won).toBe(true);
    expect(cashoutJson.data.multiplier).toBeGreaterThanOrEqual(1.00);
    expect(cashoutJson.data.winMinor).toBeGreaterThan(0);
    expect(cashoutJson.data.serverSeed).toBeDefined(); // revealed commit

    const winMinor = cashoutJson.data.winMinor;

    // 7. Post-Cashout Wallet Verification
    const walletAfterRes = await fetch(`${baseUrl}/api/v1/wallet`, {
      headers: { Authorization: `Bearer ${playerToken}` },
    });
    const walletAfterJson = await walletAfterRes.json();
    expect(walletAfterRes.status).toBe(200);
    expect(walletAfterJson.ok).toBe(true);
    expect(walletAfterJson.data.availableMinor).toBe(initialBalanceMinor - betMinor + winMinor);

    // 8. Account Statement Verification
    const statementRes = await fetch(`${baseUrl}/api/v1/wallet/statement`, {
      headers: { Authorization: `Bearer ${playerToken}` },
    });
    const statementJson = await statementRes.json();
    expect(statementRes.status).toBe(200);
    expect(statementJson.ok).toBe(true);
    expect(statementJson.data.summary).toBeDefined();

    // Verify ledger contains game_bet and game_win
    const ledgerRows = await db!.query(
      `SELECT entry_type, amount_minor, direction FROM ledger_entries
       WHERE wallet_account_id = (SELECT id FROM wallet_accounts WHERE user_id = $1)
       ORDER BY created_at DESC`,
      [testUserAId]
    );
    const betEntry = ledgerRows.rows.find((e: any) => e.entry_type === 'game_bet');
    const winEntry = ledgerRows.rows.find((e: any) => e.entry_type === 'game_win');
    expect(betEntry).toBeDefined();
    expect(winEntry).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // FLOW 2: Slot Machine E2E
  // launch → spin → wallet → statement
  // --------------------------------------------------------------------------
  it('completes Slot Machine lifecycle: launch → spin → wallet → statement', async () => {
    // 1. Launch Slot Game
    const launchRes = await fetch(`${baseUrl}/api/v1/games/${localSlotGameId}/launch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const launchJson = await launchRes.json();
    expect(launchRes.status).toBe(200);
    expect(launchJson.ok).toBe(true);
    expect(launchJson.data.launchUrl).toContain('/games/play');
    const sessionId = launchJson.data.sessionId;

    // 2. Pre-spin balance
    const walletRes1 = await fetch(`${baseUrl}/api/v1/wallet`, { headers: { Authorization: `Bearer ${tokenA}` } });
    const balanceBefore = (await walletRes1.json()).data.availableMinor;

    // 3. Spin Reels
    const spinBetMinor = 1000; // PKR 10
    const spinRes = await fetch(`${baseUrl}/api/v1/games/play/spin`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
        'x-game-session-id': sessionId,
      },
      body: JSON.stringify({
        gameId: localSlotGameId,
        sessionId,
        betMinor: spinBetMinor,
      }),
    });
    const spinJson = await spinRes.json();
    expect(spinRes.status).toBe(200);
    expect(spinJson.ok).toBe(true);
    expect(spinJson.data.reels).toHaveLength(3);
    expect(spinJson.data.newBalanceMinor).toBe(balanceBefore - spinBetMinor + spinJson.data.winMinor);

    // 4. Wallet matches spin balance
    const walletRes2 = await fetch(`${baseUrl}/api/v1/wallet`, { headers: { Authorization: `Bearer ${tokenA}` } });
    const balanceAfter = (await walletRes2.json()).data.availableMinor;
    expect(balanceAfter).toBe(spinJson.data.newBalanceMinor);
  });

  // --------------------------------------------------------------------------
  // FLOW 3: Session Ownership & Expiry Checks
  // --------------------------------------------------------------------------
  describe('Session Ownership, Expiry and Error Consistency', () => {
    it('rejects bet when session has expired with 403 SESSION_EXPIRED', async () => {
      // Create an expired session for User A
      const expiredSessId = crypto.randomUUID();
      await db!.query(
        `INSERT INTO game_sessions (id, user_id, game_id, provider_id, status, expires_at)
         VALUES ($1, $2, $3, $4, 'active', now() - INTERVAL '10 minutes')`,
        [expiredSessId, testUserAId, localCrashGameId, internalProviderId]
      );

      const res = await fetch(`${baseUrl}/api/v1/games/crash/bet`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          betMinor: 2000,
          sessionId: expiredSessId,
        }),
      });
      const json = await res.json();
      expect(res.status).toBe(403);
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe('SESSION_EXPIRED');
    });

    it('rejects bet when session belongs to a different user with 403 SESSION_INVALID', async () => {
      // Create active session for User B
      const sessUserB = crypto.randomUUID();
      await db!.query(
        `INSERT INTO game_sessions (id, user_id, game_id, provider_id, status, expires_at)
         VALUES ($1, $2, $3, $4, 'active', now() + INTERVAL '1 hour')`,
        [sessUserB, testUserBId, localCrashGameId, internalProviderId]
      );

      // User A attempts to bet using User B's session ID
      const res = await fetch(`${baseUrl}/api/v1/games/crash/bet`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          betMinor: 2000,
          sessionId: sessUserB,
        }),
      });
      const json = await res.json();
      expect(res.status).toBe(403);
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe('SESSION_INVALID');
    });

    it('rejects bet when session does not match requested game with 400 SESSION_GAME_MISMATCH', async () => {
      // Session created for slot game
      const slotSession = crypto.randomUUID();
      await db!.query(
        `INSERT INTO game_sessions (id, user_id, game_id, provider_id, status, expires_at)
         VALUES ($1, $2, $3, $4, 'active', now() + INTERVAL '1 hour')`,
        [slotSession, testUserAId, localSlotGameId, internalProviderId]
      );

      // Attempt to use slot session for crash game
      const res = await fetch(`${baseUrl}/api/v1/games/crash/bet`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          betMinor: 2000,
          gameId: localCrashGameId,
          sessionId: slotSession,
        }),
      });
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe('SESSION_GAME_MISMATCH');
    });
  });

  // --------------------------------------------------------------------------
  // FLOW 4: Local vs External Provider Behavior
  // --------------------------------------------------------------------------
  describe('Local Game vs External Provider Distinction', () => {
    it('fails closed with 503 PROVIDER_NOT_CONFIGURED for unconfigured external providers', async () => {
      // Ensure no adapter is registered for pragmatic_ext
      clearProviders();

      const launchRes = await fetch(`${baseUrl}/api/v1/games/${externalProviderGameId}/launch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const json = await launchRes.json();

      expect(launchRes.status).toBe(503);
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe('PROVIDER_NOT_CONFIGURED');
      // Must NOT synthesize a usable local launch URL!
      expect(json.data).toBeUndefined();
    });

    it('successfully calls registered provider adapter boundary when configured', async () => {
      // Register a mock provider adapter for externalProviderId
      const mockAdapter: ProviderAdapter = {
        async getCatalog() { return []; },
        async createLaunchSession(ctx) {
          return {
            launchUrl: `https://pragmatic-play.games/launch?token=ext_${ctx.userId}`,
            sessionId: `ext_sess_${Date.now()}`,
          };
        },
        verifyWebhook() { return true; },
      };

      registerProvider('pragmatic_ext', mockAdapter);

      const launchRes = await fetch(`${baseUrl}/api/v1/games/${externalProviderGameId}/launch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const json = await launchRes.json();

      expect(launchRes.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.data.isLocal).toBe(false);
      expect(json.data.launchUrl).toContain('https://pragmatic-play.games/launch?token=');
      expect(json.data.sessionId).toBeDefined();

      clearProviders();
    });

    it('rejects launch on a disabled provider with 400 PROVIDER_NOT_AVAILABLE', async () => {
      const launchRes = await fetch(`${baseUrl}/api/v1/games/${disabledProviderGameId}/launch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const json = await launchRes.json();

      expect(launchRes.status).toBe(400);
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe('PROVIDER_NOT_AVAILABLE');
    });
  });

  // --------------------------------------------------------------------------
  // FLOW 5: Route-Not-Found, Missing Auth & Interrupted Connection Behavior
  // --------------------------------------------------------------------------
  describe('Route-Not-Found, Auth & Interrupted Connection Resilience', () => {
    it('returns 404 ROUTE_NOT_FOUND for non-existent routes', async () => {
      const res = await fetch(`${baseUrl}/api/v1/non_existent_route`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const json = await res.json();
      expect(res.status).toBe(404);
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe('ROUTE_NOT_FOUND');
    });

    it('returns 401 AUTHENTICATION_REQUIRED on missing or invalid JWT tokens', async () => {
      // Missing token
      const resNoAuth = await fetch(`${baseUrl}/api/v1/games/${localCrashGameId}/launch`, { method: 'POST' });
      expect(resNoAuth.status).toBe(401);

      // Malformed token
      const resBadToken = await fetch(`${baseUrl}/api/v1/games/${localCrashGameId}/launch`, {
        method: 'POST',
        headers: { Authorization: 'Bearer invalid.corrupted.token' },
      });
      expect(resBadToken.status).toBe(401);
    });

    it('returns 404 ROUND_NOT_FOUND when attempting cashout on non-existent or interrupted round', async () => {
      const res = await fetch(`${baseUrl}/api/v1/games/crash/cashout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roundId: crypto.randomUUID(), // non-existent round
          multiplier: 2.0,
        }),
      });
      const json = await res.json();
      expect(res.status).toBe(404);
      expect(json.ok).toBe(false);
      expect(json.error.code).toBe('ROUND_NOT_FOUND');
    });

    it('does not mount demo faucet in production environment', async () => {
      const oldEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        // Re-create app in production mode
        const prodApp = createApp(db);
        const prodServer = prodApp.listen(0);
        const prodPort = (prodServer.address() as AddressInfo).port;

        const res = await fetch(`http://127.0.0.1:${prodPort}/api/v1/games/play/faucet`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenA}` },
        });

        // In production, the demo faucet route is unmounted and returns 404 ROUTE_NOT_FOUND
        expect(res.status).toBe(404);
        const json = await res.json();
        expect(json.error.code).toBe('ROUTE_NOT_FOUND');

        await new Promise<void>((r) => prodServer.close(() => r()));
      } finally {
        process.env.NODE_ENV = oldEnv;
      }
    });
  });
});
