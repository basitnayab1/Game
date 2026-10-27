import type { Request, Response } from 'express';
import type { DatabaseClient } from '../../core/database/database.types.js';
import crypto from 'node:crypto';
import { hasProvider, getProvider } from './provider.registry.js';

export async function launchGame(req: Request, res: Response) {
  const db = req.app.locals.db as DatabaseClient | undefined;
  if (!db) {
    return res.status(503).json({ ok: false, error: { code: 'DATABASE_NOT_CONFIGURED', message: 'Game launch is temporarily unavailable.' } });
  }

  const gameId = String(req.params.gameId || '').trim();
  const userId = String((req as any).auth?.userId || (req as any).user?.id || '').trim();
  if (!gameId || !userId) {
    return res.status(400).json({ ok: false, error: { code: 'INVALID_LAUNCH_REQUEST', message: 'Game and authenticated user are required.' } });
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(gameId);
  const whereGame = isUuid ? `(g.id::text = $2 OR g.external_game_id = $2)` : `g.external_game_id = $2`;

  const result = await db.query<{
    userStatus: string;
    gameId: string;
    gameName: string;
    category: string;
    gameStatus: string;
    externalGameId: string;
    providerId: string;
    providerName: string;
    providerStatus: string;
    externalProviderId: string | null;
    isAuthorized?: boolean;
  }>(
    `SELECT u.status AS "userStatus",
            g.id AS "gameId",
            g.name AS "gameName",
            g.category AS "category",
            g.status AS "gameStatus",
            g.external_game_id AS "externalGameId",
            g.provider_id AS "providerId",
            p.name AS "providerName",
            p.status AS "providerStatus",
            p.external_provider_id AS "externalProviderId",
            p.is_authorized AS "isAuthorized"
       FROM users u
       JOIN games g ON ${whereGame}
       JOIN game_providers p ON p.id = g.provider_id
      WHERE u.id = $1`,
    [userId, gameId],
  );

  const row = result.rows[0];
  if (!row) {
    return res.status(404).json({ ok: false, error: { code: 'GAME_NOT_FOUND', message: 'Game is unavailable or does not exist.' } });
  }

  // 1. Account restriction
  if (row.userStatus !== 'active') {
    return res.status(403).json({ ok: false, error: { code: 'ACCOUNT_NOT_ELIGIBLE', message: 'Account is not eligible to launch games.' } });
  }

  // 2. Game status
  if (row.gameStatus !== 'active') {
    return res.status(400).json({ ok: false, error: { code: 'GAME_NOT_AVAILABLE', message: 'Game is currently inactive.' } });
  }

  // 3. Provider status
  if (row.providerStatus !== 'active') {
    return res.status(400).json({ ok: false, error: { code: 'PROVIDER_NOT_AVAILABLE', message: 'Game provider is currently disabled.' } });
  }

  // 4. Distinguish Local Game vs External Provider
  const extProv = (row.externalProviderId || '').toLowerCase().trim();
  const provName = (row.providerName || '').toLowerCase().trim();
  const cat = (row.category || '').toLowerCase().trim();
  const gameName = (row.gameName || '').toLowerCase().trim();
  const extGameId = (row.externalGameId || '').toLowerCase().trim();

  const isLocalProvider = extProv === 'internal' || extProv === 'n5' || extProv === 'local' ||
                          provName.includes('n5') || provName.includes('internal') ||
                          provName.includes('in-house') || !extProv;

  const isCrash = cat.includes('crash') || gameName.includes('aviator') || extGameId.includes('aviator');
  const isSlot = cat.includes('slot') || extGameId === 'gates-olympus' || extGameId === 'fruit-slot';

  const isLocalGame = isLocalProvider || ((isCrash || isSlot) && !extProv.startsWith('ext_') && !hasProvider(extProv));

  // A. Local game execution (Crash / Slot engine)
  if (isLocalGame) {
    const sessionId = crypto.randomUUID();
    const launchPath = isCrash ? '/games/aviator' : '/games/play';
    const launchUrl = `${launchPath}?session=${sessionId}&game=${encodeURIComponent(row.gameId)}&name=${encodeURIComponent(row.gameName)}`;
    const expiresAt = new Date(Date.now() + 2 * 3600 * 1000); // 2-hour session

    await db.query(
      `INSERT INTO game_sessions (id, user_id, game_id, provider_id, provider_session_id, status, launch_url, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
       ON CONFLICT (id) DO UPDATE SET updated_at = now()`,
      [sessionId, userId, row.gameId, row.providerId, sessionId, launchUrl, expiresAt],
    );

    await db.query(
      `INSERT INTO recently_played_games (user_id, game_id, last_played_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id, game_id) DO UPDATE SET last_played_at = EXCLUDED.last_played_at`,
      [userId, row.gameId],
    ).catch(() => {});

    return res.status(200).json({
      ok: true,
      data: {
        gameId: row.gameId,
        gameName: row.gameName,
        category: row.category,
        providerName: row.providerName,
        isLocal: true,
        sessionId,
        launchUrl,
        expiresAt: expiresAt.toISOString(),
      },
    });
  }

  // B. External Provider execution
  const providerKey = extProv || row.providerId;
  const isConfigured = hasProvider(providerKey) || hasProvider(row.providerId);

  if (!isConfigured) {
    // Fail-closed: Never report false success or synthesize usable launch URLs for unconfigured external providers!
    return res.status(503).json({
      ok: false,
      error: {
        code: 'PROVIDER_NOT_CONFIGURED',
        message: `Game provider '${row.providerName || providerKey}' integration is unconfigured or unavailable.`,
      },
    });
  }

  try {
    const adapter = getProvider(hasProvider(providerKey) ? providerKey : row.providerId);
    const sessionResult = await adapter.createLaunchSession({
      userId,
      gameId: row.gameId,
      locale: 'en',
    });

    if (!sessionResult || !sessionResult.launchUrl) {
      return res.status(502).json({
        ok: false,
        error: { code: 'PROVIDER_LAUNCH_FAILED', message: 'Provider returned an empty launch URL.' },
      });
    }

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 2 * 3600 * 1000);

    await db.query(
      `INSERT INTO game_sessions (id, user_id, game_id, provider_id, provider_session_id, status, launch_url, expires_at)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $7)
       ON CONFLICT (id) DO UPDATE SET updated_at = now()`,
      [sessionId, userId, row.gameId, row.providerId, sessionResult.sessionId || sessionId, sessionResult.launchUrl, expiresAt],
    );

    await db.query(
      `INSERT INTO recently_played_games (user_id, game_id, last_played_at)
       VALUES ($1, $2, now())
       ON CONFLICT (user_id, game_id) DO UPDATE SET last_played_at = EXCLUDED.last_played_at`,
      [userId, row.gameId],
    ).catch(() => {});

    return res.status(200).json({
      ok: true,
      data: {
        gameId: row.gameId,
        gameName: row.gameName,
        category: row.category,
        providerName: row.providerName,
        isLocal: false,
        sessionId,
        launchUrl: sessionResult.launchUrl,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (err: any) {
    return res.status(502).json({
      ok: false,
      error: {
        code: 'PROVIDER_LAUNCH_FAILED',
        message: `Failed to initialize session with game provider: ${err.message || 'Unknown error'}`,
      },
    });
  }
}
