export type Environment = 'development' | 'test' | 'staging' | 'production';
export interface ReleaseConfig { environment: Environment; apiBaseUrl: string; appVersion: string; maintenanceMode: boolean; requireHttps: boolean; }
export function validateReleaseConfig(config: ReleaseConfig): void { if (!config.apiBaseUrl.trim()) throw new Error('API base URL required'); if (!config.appVersion.trim()) throw new Error('App version required'); if (config.environment === 'production' && !config.requireHttps) throw new Error('Production requires HTTPS'); }
