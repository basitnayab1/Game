export interface HealthStatus { service: string; status: 'OK' | 'DEGRADED' | 'DOWN'; timestamp: string; checks: Record<string, 'OK' | 'FAILED' | 'SKIPPED'>; }
export function isHealthy(status: HealthStatus): boolean { return status.status === 'OK' && Object.values(status.checks).every(value => value !== 'FAILED'); }
