import type { GameRuntimeSession, GameLaunchFailure } from './game-runtime-recovery.contract';

export function validateLaunchSession(session: GameRuntimeSession, now = new Date()): void {
  if (!session.sessionId || !session.gameId || !session.providerId) {
    throw new Error('INVALID_LAUNCH_SESSION');
  }
  if (session.state !== 'REQUESTING' && session.state !== 'LAUNCHING' && session.state !== 'ACTIVE' && session.state !== 'RECONNECTING') {
    throw new Error('LAUNCH_SESSION_NOT_ACTIVE');
  }
  if (now.getTime() >= Date.parse(session.expiresAt)) {
    throw new Error('GAME_SESSION_EXPIRED');
  }
}

export function classifyLaunchFailure(code: GameLaunchFailure['code']): GameLaunchFailure {
  const retryable = code === 'NETWORK_TIMEOUT' || code === 'SESSION_EXPIRED' || code === 'PROVIDER_UNAVAILABLE';
  return {
    code,
    retryable,
    userMessageKey: `game.launch.${code.toLowerCase()}`,
  };
}

export function shouldCreateFreshSession(failure: GameLaunchFailure): boolean {
  return failure.code === 'SESSION_EXPIRED' || failure.code === 'PROVIDER_UNAVAILABLE' || failure.code === 'NETWORK_TIMEOUT';
}
