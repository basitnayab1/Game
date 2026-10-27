export type AppEnvironment = 'development' | 'test' | 'staging' | 'production';

export type AppConfig = {
  nodeEnv: AppEnvironment;
  port: number;
  apiPrefix: string;
  databaseUrl?: string;
  redisUrl?: string;
  jwtAccessSecret?: string;
  jwtRefreshSecret?: string;
  corsOrigin?: string;
};

export function validateConfig(config: AppConfig): string[] {
  const errors: string[] = [];
  if (!config.port || config.port < 1 || config.port > 65535) errors.push('PORT must be a valid TCP port');
  if (!config.apiPrefix.startsWith('/')) errors.push('API_PREFIX must start with /');

  const protectedEnvironment = config.nodeEnv === 'staging' || config.nodeEnv === 'production';
  if (protectedEnvironment) {
    if (!config.databaseUrl) errors.push(`DATABASE_URL is required in ${config.nodeEnv}`);
    if (!config.jwtAccessSecret) {
      errors.push(`JWT access secret is required in ${config.nodeEnv}`);
    } else if (config.jwtAccessSecret.length < 32) {
      errors.push(`JWT access secret must be at least 32 characters in ${config.nodeEnv}`);
    }
    if (!config.jwtRefreshSecret) {
      errors.push(`JWT refresh secret is required in ${config.nodeEnv}`);
    } else if (config.jwtRefreshSecret.length < 32) {
      errors.push(`JWT refresh secret must be at least 32 characters in ${config.nodeEnv}`);
    }
  }

  if (config.nodeEnv === 'production') {
    if (config.apiPrefix !== '/api/v1') errors.push('API_PREFIX must be /api/v1 in production');
    if (!config.corsOrigin || config.corsOrigin.trim() === '*' || config.corsOrigin.includes('*')) {
      errors.push('CORS_ORIGIN must be an explicit origin in production');
    }
  }
  return errors;
}
