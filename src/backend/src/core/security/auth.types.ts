export interface AuthUser {
  id: string;
  sessionId: string;
  roles: string[];
}

export interface AuthContext {
  user: AuthUser;
}
