export interface GameListItem { id: string; providerId: string; name: string; category: string; artworkUrl?: string; status: 'ACTIVE' | 'INACTIVE'; }
export interface GameLaunchResponse { sessionId: string; providerId: string; launchUrl: string; expiresAt: string; }
export interface GameSearchRequest { query?: string; category?: string; providerId?: string; }

export function requireActiveGame(game: GameListItem): void { if (game.status !== 'ACTIVE') throw new Error('Game unavailable'); }
