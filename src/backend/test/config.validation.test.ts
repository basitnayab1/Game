import { validateConfig } from '../src/core/config/env.schema';

describe('validateConfig', () => {
  it('accepts a valid development configuration', () => {
    expect(validateConfig({ nodeEnv: 'development', port: 3000, apiPrefix: '/api/v1' })).toEqual([]);
  });

  it('requires protected-environment secrets and database configuration', () => {
    const errors = validateConfig({ nodeEnv: 'production', port: 3000, apiPrefix: '/api/v1' });
    expect(errors).toContain('DATABASE_URL is required in production');
    expect(errors).toContain('JWT access secret is required in production');
    expect(errors).toContain('JWT refresh secret is required in production');
  });

  it('rejects wildcard CORS in production', () => {
    const errors = validateConfig({
      nodeEnv: 'production', port: 3000, apiPrefix: '/api/v1',
      databaseUrl: 'postgres://configured', jwtAccessSecret: 'a'.repeat(32),
      jwtRefreshSecret: 'b'.repeat(32), corsOrigin: '*'
    });
    expect(errors).toContain('CORS_ORIGIN must be an explicit origin in production');
  });

  it('rejects JWT secrets with fewer than 32 characters in production', () => {
    const errors = validateConfig({
      nodeEnv: 'production',
      port: 3000,
      apiPrefix: '/api/v1',
      databaseUrl: 'postgres://configured',
      jwtAccessSecret: 'short_access_secret_123',
      jwtRefreshSecret: 'short_refresh_secret_123',
      corsOrigin: 'https://n5game.com',
    });
    expect(errors).toContain('JWT access secret must be at least 32 characters in production');
    expect(errors).toContain('JWT refresh secret must be at least 32 characters in production');
  });
});
