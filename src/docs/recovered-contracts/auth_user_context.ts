export interface AuthenticatedUserContext {
  userId: string;
  sessionId: string;
  roles: string[];
}

export function requireUserContext(value: AuthenticatedUserContext | undefined): AuthenticatedUserContext {
  if (!value?.userId || !value.sessionId) throw new Error('AUTHENTICATION_REQUIRED');
  return value;
}
