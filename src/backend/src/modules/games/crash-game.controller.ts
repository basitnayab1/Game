import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import crypto from 'node:crypto';

function crashStoreUnavailable(res: Response) {
  return res.status(503).json({ ok: false, error: { code: 'GAME_STORE_UNAVAILABLE', message: 'Crash game requires the PostgreSQL database to be configured.' } });
}

/**
 * Mathematically verifiable, provably fair HMAC-SHA256 crash point derivation.
 * Standard 96% RTP formula: no fake Math.random() disconnected from the hash!
 */
export function calculateProvablyFairCrashPoint(
  serverSeed: string,
  clientSeed: string,
  nonce: number | bigint | string
): number {
  const message = `${clientSeed}:${nonce}`;
  const hmac = crypto.createHmac('sha256', serverSeed).update(message).digest('hex');

  // Parse first 13 hex characters (52 bits)
  const h = parseInt(hmac.slice(0, 13), 16);
  const e = Math.pow(2, 52); // 4503599627370496

  // 1 in 33 rounds instant house crash at 1.00x (~3.03% house edge)
  if (h % 33 === 0) {
    return 1.00;
  }

  // Provably fair multiplier calculation: 96% RTP
  const rawMultiplier = Math.floor((100 * e - h) / (e - h)) / 100;
  const crashPoint = Math.max(1.00, Number(Math.min(rawMultiplier, 1000.00).toFixed(2)));
  return crashPoint;
}

/**
 * Server-authoritative multiplier curve as a function of elapsed time.
 * Curve: 1.00 + (t * 0.90)^1.45 (matches UI flight animation).
 */
export function calculateMultiplierAtElapsed(elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 1.00;
  const mult = 1.00 + Math.pow(elapsedSeconds * 0.90, 1.45);
  return Number(mult.toFixed(2));
}

export function timeToReachMultiplier(targetMultiplier: number): number {
  if (targetMultiplier <= 1.00) return 0;
  return Math.pow(targetMultiplier - 1.00, 1 / 1.45) / 0.90;
}

/**
 * Background / startup recovery of dangling active crash rounds.
 */
export async function recoverDanglingCrashRounds(db: DatabaseClient, maxAgeSeconds = 60): Promise<number> {
  const result = await db.query<{ count: string }>(
    `WITH updated AS (
       UPDATE crash_game_rounds
          SET status = 'crashed',
              settled_at = now(),
              updated_at = now()
        WHERE status = 'active'
          AND started_at < (now() - ($1 || ' seconds')::INTERVAL)
        RETURNING id
     )
     SELECT count(*)::text AS count FROM updated`,
    [maxAgeSeconds.toString()]
  );
  return Number(result.rows[0]?.count || 0);
}

export async function placeCrashBet(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  const userId = String((req as any).auth?.userId || (req as any).user?.id || '').trim();
  if (!userId) {
    return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
  }

  const { betMinor, gameId, sessionId: reqSessionId, clientSeed: reqClientSeed, idempotencyKey: bodyKey } = req.body || {};
  const sessionId = String(req.header('x-game-session-id') || reqSessionId || '').trim() || null;
  const idempotencyKey = String(req.header('idempotency-key') || bodyKey || '').trim() || null;
  const bet = Number(betMinor);

  // 1. Betting limits validation
  if (!bet || isNaN(bet) || !Number.isSafeInteger(bet) || bet < 1000 || bet > 500000) {
    return res.status(400).json({
      ok: false,
      error: { code: 'INVALID_BET_AMOUNT', message: 'Bet must be between PKR 10 (1,000 minor) and PKR 5,000 (500,000 minor).' },
    });
  }

  // 2. Account restriction check
  if (!db) return crashStoreUnavailable(res);

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Check user status
      const userRow = (await tx.query<{ status: string }>('SELECT status FROM users WHERE id = $1', [userId])).rows[0];
      if (userRow && userRow.status !== 'active') {
        throw { statusCode: 403, code: 'ACCOUNT_RESTRICTED', message: 'Account is restricted or suspended from placing bets.' };
      }

      // 2. Validate game session if provided
      let validSessionId: string | null = null;
      let validGameId: string | null = null;

      if (sessionId) {
        const isSessionUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId);
        if (!isSessionUuid) {
          throw { statusCode: 400, code: 'SESSION_INVALID', message: 'Session ID format is invalid.' };
        }
        const sessionRes = await tx.query<{
          id: string;
          user_id: string;
          game_id: string;
          status: string;
          expires_at: string;
        }>(
          `SELECT id, user_id, game_id, status, expires_at FROM game_sessions WHERE id = $1`,
          [sessionId]
        );
        const sess = sessionRes.rows[0];
        if (!sess || sess.user_id !== userId) {
          throw { statusCode: 403, code: 'SESSION_INVALID', message: 'Game session is invalid or belongs to another user.' };
        }
        if (sess.status !== 'active' || new Date(sess.expires_at).getTime() <= Date.now()) {
          throw { statusCode: 403, code: 'SESSION_EXPIRED', message: 'Game session has expired. Please launch the game again.' };
        }
        validSessionId = sess.id;
        validGameId = sess.game_id;
      }

      // 3. Validate game if provided
      if (gameId) {
        const isGameUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(gameId);
        if (isGameUuid) {
          const gameRes = await tx.query<{ id: string; status: string }>(
            `SELECT id, status FROM games WHERE id = $1`,
            [gameId]
          );
          const gameRow = gameRes.rows[0];
          if (gameRow) {
            if (gameRow.status !== 'active') {
              throw { statusCode: 400, code: 'GAME_NOT_AVAILABLE', message: 'Game is currently inactive.' };
            }
            if (validGameId && validGameId !== gameRow.id) {
              throw { statusCode: 400, code: 'SESSION_GAME_MISMATCH', message: 'Session does not match the requested game.' };
            }
            validGameId = gameRow.id;
          }
        }
      }

      // 4. Check for duplicate bet with idempotency key
      if (idempotencyKey) {
        const existing = await tx.query<{ id: string; bet_minor: string; server_seed_hash: string; client_seed: string; nonce: string; status: string }>(
          `SELECT id, bet_minor, server_seed_hash, client_seed, nonce, status FROM crash_game_rounds WHERE idempotency_key = $1`,
          [idempotencyKey]
        );
        if (existing.rows.length > 0) {
          const row = existing.rows[0];
          return {
            roundId: row.id,
            betMinor: Number(row.bet_minor),
            betPkr: Number(row.bet_minor) / 100,
            crashHash: row.server_seed_hash,
            clientSeed: row.client_seed,
            nonce: Number(row.nonce),
            status: row.status,
            replayed: true,
          };
        }
      }

      // 5. Prevent duplicate active bets for same user
      const activeCheck = await tx.query<{ id: string; started_at: string; crash_point: string }>(
        `SELECT id, started_at, crash_point FROM crash_game_rounds
          WHERE user_id = $1 AND status = 'active'
          FOR UPDATE`,
        [userId]
      );

      if (activeCheck.rows.length > 0) {
        const activeRow = activeCheck.rows[0];
        const elapsed = (Date.now() - new Date(activeRow.started_at).getTime()) / 1000;
        if (elapsed < 60) {
          throw { statusCode: 409, code: 'ACTIVE_ROUND_EXISTS', message: 'You already have an active round in progress.' };
        } else {
          // Auto-settle stale round as crashed
          await tx.query(`UPDATE crash_game_rounds SET status = 'crashed', settled_at = now() WHERE id = $1`, [activeRow.id]);
        }
      }

      // 6. Lock wallet and deduct bet
      const wallet = (await tx.query<{ id: string; available_minor: string }>(
        `SELECT id, available_minor FROM wallet_accounts WHERE user_id = $1 AND currency = 'PKR' FOR UPDATE`,
        [userId]
      )).rows[0];

      if (!wallet) throw { statusCode: 404, code: 'WALLET_NOT_FOUND', message: 'Wallet account not found.' };

      const available = BigInt(wallet.available_minor);
      const betBig = BigInt(bet);
      if (available < betBig) {
        throw { statusCode: 400, code: 'INSUFFICIENT_FUNDS', message: `Insufficient funds. Available: PKR ${(Number(available) / 100).toFixed(2)}` };
      }

      await tx.query(
        `UPDATE wallet_accounts
            SET available_minor = available_minor - $1,
                version = version + 1,
                updated_at = now()
          WHERE id = $2`,
        [betBig.toString(), wallet.id]
      );

      // 7. Generate Provably Fair seeds and crash point
      const serverSeed = crypto.randomBytes(32).toString('hex');
      const serverSeedHash = crypto.createHash('sha256').update(serverSeed).digest('hex');
      const clientSeed = String(reqClientSeed || crypto.randomBytes(8).toString('hex')).trim();

      // Get user nonce
      const nonceRes = await tx.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM crash_game_rounds WHERE user_id = $1`,
        [userId]
      );
      const nonce = Number(nonceRes.rows[0]?.count || 0) + 1;

      const crashPoint = calculateProvablyFairCrashPoint(serverSeed, clientSeed, nonce);
      const roundId = crypto.randomUUID();

      // 8. Durable database storage of round
      await tx.query(
        `INSERT INTO crash_game_rounds (
           id, user_id, wallet_account_id, game_id, session_id, bet_minor, crash_point,
           server_seed, server_seed_hash, client_seed, nonce, status, idempotency_key, started_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', $12, now())`,
        [
          roundId,
          userId,
          wallet.id,
          validGameId,
          validSessionId,
          betBig.toString(),
          crashPoint,
          serverSeed,
          serverSeedHash,
          clientSeed,
          nonce,
          idempotencyKey,
        ]
      );

      // 7. Double-entry ledger entry
      const ledgerIdempKey = `crash_bet:${roundId}`;
      await tx.query(
        `INSERT INTO ledger_entries (
           wallet_account_id, entry_type, direction, amount_minor, currency, reference_type, reference_id, idempotency_key, metadata
         ) VALUES ($1, 'game_bet', 'debit', $2, 'PKR', 'game', $3, $4, $5)
         ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
        [
          wallet.id,
          betBig.toString(),
          roundId,
          ledgerIdempKey,
          JSON.stringify({ game: 'Aviator Crash', gameId, betMinor: bet, crashHash: serverSeedHash }),
        ]
      );

      return {
        roundId,
        betMinor: bet,
        betPkr: bet / 100,
        crashHash: serverSeedHash,
        clientSeed,
        nonce,
        status: 'active',
        newBalanceMinor: Number(available - betBig),
      };
    });

    return res.status(200).json({ ok: true, data: result });
  } catch (error: any) {
    const status = error.statusCode || 400;
    return res.status(status).json({
      ok: false,
      error: { code: error.code || 'BET_FAILED', message: error.message || 'Failed to place crash bet.' },
    });
  }
}

export async function cashoutCrashBet(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  const userId = String((req as any).auth?.userId || (req as any).user?.id || '').trim();
  if (!userId) {
    return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
  }

  const { roundId, multiplier: clientMultRaw } = req.body || {};
  if (!roundId) {
    return res.status(400).json({ ok: false, error: { code: 'ROUND_ID_REQUIRED', message: 'Round ID is required.' } });
  }

  const clientMult = clientMultRaw !== undefined ? Number(clientMultRaw) : null;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(roundId));
  if (!isUuid) {
    return res.status(404).json({ ok: false, error: { code: 'ROUND_NOT_FOUND', message: 'Round not found.' } });
  }

  if (!db) return crashStoreUnavailable(res);

  try {
    const result = await db.transaction(async (tx) => {
      // 1. Lock round row FOR UPDATE
      const roundRows = (await tx.query<{
        id: string;
        user_id: string;
        wallet_account_id: string;
        bet_minor: string;
        crash_point: string;
        server_seed: string;
        server_seed_hash: string;
        client_seed: string;
        nonce: string;
        status: string;
        cashed_out_multiplier: string | null;
        payout_minor: string;
        started_at: string;
      }>(
        `SELECT id, user_id, wallet_account_id, bet_minor, crash_point, server_seed, server_seed_hash,
                client_seed, nonce, status, cashed_out_multiplier, payout_minor, started_at
           FROM crash_game_rounds
          WHERE id = $1
          FOR UPDATE`,
        [roundId]
      )).rows;

      if (roundRows.length === 0) {
        throw { statusCode: 404, code: 'ROUND_NOT_FOUND', message: 'Round not found.' };
      }

      const round = roundRows[0];

      // 2. Round ownership verification
      if (round.user_id !== userId) {
        throw { statusCode: 403, code: 'ROUND_FORBIDDEN', message: 'You do not own this game round.' };
      }

      const crashPoint = Number(round.crash_point);
      const betMinor = BigInt(round.bet_minor);

      // 3. Idempotent return if already settled
      if (round.status === 'cashed_out') {
        return {
          won: true,
          replayed: true,
          multiplier: Number(round.cashed_out_multiplier),
          winMinor: Number(round.payout_minor),
          winPkr: Number(round.payout_minor) / 100,
          crashPoint,
          serverSeed: round.server_seed,
        };
      }

      if (round.status === 'crashed') {
        return {
          won: false,
          crashed: true,
          crashPoint,
          serverSeed: round.server_seed,
          message: `Plane crashed at ${crashPoint}x!`,
        };
      }

      // 4. Server-authoritative multiplier calculation based on elapsed time
      const elapsedSeconds = Math.max(0, (Date.now() - new Date(round.started_at).getTime()) / 1000);
      const serverMultiplier = calculateMultiplierAtElapsed(elapsedSeconds);

      // Did plane crash before cashout?
      if (serverMultiplier >= crashPoint) {
        await tx.query(
          `UPDATE crash_game_rounds
              SET status = 'crashed',
                  settled_at = now(),
                  updated_at = now()
            WHERE id = $1`,
          [roundId]
        );

        return {
          won: false,
          crashed: true,
          crashPoint,
          serverSeed: round.server_seed,
          message: `Plane flew away at ${crashPoint}x!`,
        };
      }

      // 5. Server-authoritative multiplier selection: client cannot claim more than server elapsed time
      const effectiveMultiplier = clientMult && !isNaN(clientMult)
        ? Math.max(1.00, Math.min(clientMult, serverMultiplier, crashPoint))
        : Math.max(1.00, Math.min(serverMultiplier, crashPoint));

      const winMinor = BigInt(Math.floor(Number(betMinor) * effectiveMultiplier));

      // 6. Lock wallet and credit winnings
      const wallet = (await tx.query<{ id: string; available_minor: string }>(
        `SELECT id, available_minor FROM wallet_accounts WHERE id = $1 FOR UPDATE`,
        [round.wallet_account_id]
      )).rows[0];

      if (!wallet) throw { statusCode: 404, code: 'WALLET_NOT_FOUND', message: 'Wallet not found.' };

      await tx.query(
        `UPDATE wallet_accounts
            SET available_minor = available_minor + $1,
                version = version + 1,
                updated_at = now()
          WHERE id = $2`,
        [winMinor.toString(), wallet.id]
      );

      // 7. Update round record
      await tx.query(
        `UPDATE crash_game_rounds
            SET status = 'cashed_out',
                cashed_out_multiplier = $2,
                payout_minor = $3,
                settled_at = now(),
                updated_at = now()
          WHERE id = $1`,
        [roundId, effectiveMultiplier, winMinor.toString()]
      );

      // 8. Insert win into double-entry ledger with idempotency
      const ledgerIdempKey = `crash_win:${roundId}`;
      await tx.query(
        `INSERT INTO ledger_entries (
           wallet_account_id, entry_type, direction, amount_minor, currency, reference_type, reference_id, idempotency_key, metadata
         ) VALUES ($1, 'game_win', 'credit', $2, 'PKR', 'game', $3, $4, $5)
         ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
        [
          wallet.id,
          winMinor.toString(),
          roundId,
          ledgerIdempKey,
          JSON.stringify({
            game: 'Aviator Crash',
            multiplier: effectiveMultiplier,
            crashPoint,
            winMinor: winMinor.toString(),
          }),
        ]
      );

      return {
        won: true,
        multiplier: effectiveMultiplier,
        winMinor: Number(winMinor),
        winPkr: Number(winMinor) / 100,
        crashPoint,
        serverSeed: round.server_seed,
        serverSeedHash: round.server_seed_hash,
        newBalanceMinor: Number(BigInt(wallet.available_minor) + winMinor),
      };
    });

    return res.status(200).json({ ok: true, data: result });
  } catch (error: any) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      ok: false,
      error: { code: error.code || 'CASHOUT_FAILED', message: error.message || 'Failed to cash out crash round.' },
    });
  }
}

export async function getCrashRoundStatus(req: Request, res: Response) {
  const db = (req.app.locals as { db?: DatabaseClient }).db;
  const roundId = String(req.params.roundId || req.query.roundId || '').trim();
  const userId = String((req as any).auth?.userId || (req as any).user?.id || '').trim();

  if (!roundId) {
    return res.status(400).json({ ok: false, error: { code: 'ROUND_ID_REQUIRED' } });
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roundId);
  if (!isUuid) {
    return res.status(404).json({ ok: false, error: { code: 'ROUND_NOT_FOUND', message: 'Round not found.' } });
  }

  if (!db) return crashStoreUnavailable(res);

  try {
    const round = (await db.query<{
      id: string;
      user_id: string;
      bet_minor: string;
      crash_point: string;
      server_seed_hash: string;
      server_seed: string;
      client_seed: string;
      nonce: string;
      status: string;
      cashed_out_multiplier: string | null;
      payout_minor: string;
      started_at: string;
      settled_at: string | null;
    }>(
      `SELECT id, user_id, bet_minor, crash_point, server_seed_hash,
              CASE WHEN status != 'active' THEN server_seed ELSE NULL END AS server_seed,
              client_seed, nonce, status, cashed_out_multiplier, payout_minor, started_at, settled_at
         FROM crash_game_rounds
        WHERE id = $1`,
      [roundId]
    )).rows[0];

    if (!round) return res.status(404).json({ ok: false, error: { code: 'ROUND_NOT_FOUND' } });
    if (round.user_id !== userId) return res.status(403).json({ ok: false, error: { code: 'ROUND_FORBIDDEN' } });

    return res.json({ ok: true, data: round });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: { code: 'FETCH_ROUND_FAILED', message: error.message } });
  }
}

/**
 * Public, unauthenticated verification endpoint for mathematical Provably Fair audit.
 * Player inputs revealed serverSeed, clientSeed, and nonce; server verifies HMAC-SHA256 outcome.
 */
export async function verifyCrashFairnessController(req: Request, res: Response) {
  const { serverSeed, clientSeed, nonce, claimedHash } = req.body || {};

  if (!serverSeed || !clientSeed || nonce === undefined) {
    return res.status(400).json({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'serverSeed, clientSeed, and nonce are required for verification.' },
    });
  }

  const calculatedHash = crypto.createHash('sha256').update(String(serverSeed)).digest('hex');
  const hashMatches = claimedHash ? calculatedHash.toLowerCase() === String(claimedHash).toLowerCase() : true;
  const crashPoint = calculateProvablyFairCrashPoint(String(serverSeed), String(clientSeed), nonce);

  return res.json({
    ok: true,
    data: {
      verified: hashMatches,
      calculatedHash,
      claimedHash: claimedHash || null,
      crashPoint,
      formula: 'HMAC-SHA256(serverSeed, clientSeed:nonce) -> 52-bit float / 96% RTP',
    },
  });
}
