export type GameRuntimeState =
  | 'REQUESTING'
  | 'LAUNCHING'
  | 'ACTIVE'
  | 'RECONNECTING'
  | 'EXPIRED'
  | 'PROVIDER_UNAVAILABLE'
  | 'FAILED'
  | 'CLOSED';

export interface GameRuntimeSession {
  sessionId: string;
  gameId: string;
  providerId: string;
  state: GameRuntimeState;
  expiresAt: string;
}

export interface GameLaunchFailure {
  code:
    | 'NETWORK_TIMEOUT'
    | 'SESSION_EXPIRED'
    | 'PROVIDER_UNAVAILABLE'
    | 'INVALID_LAUNCH'
    | 'ELIGIBILITY_FAILED';
  retryable: boolean;
  userMessageKey: string;
}

export function canRetryLaunch(failure: GameLaunchFailure): boolean {
  return failure.retryable && failure.code !== 'ELIGIBILITY_FAILED';
}
