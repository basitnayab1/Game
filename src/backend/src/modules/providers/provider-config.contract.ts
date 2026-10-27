export interface AuthorizedProviderConfig { providerId: string; enabled: boolean; regionCodes: string[]; configRef: string; }
export function validateProviderConfig(config: AuthorizedProviderConfig): void { if (!config.providerId.trim()) throw new Error('Provider ID required'); if (!config.configRef.trim()) throw new Error('Provider secret/config reference required'); }
