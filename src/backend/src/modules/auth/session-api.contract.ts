export interface LoginResponse { accessToken: string; refreshToken: string; expiresIn: number; user: { id: string; status: string }; }
export interface SessionRefreshRequest { refreshToken: string; }
export interface SessionRefreshResponse { accessToken: string; refreshToken: string; expiresIn: number; }

export function requireAccessToken(token?: string): void {
  if (!token?.trim()) throw new Error('Authentication required');
}
