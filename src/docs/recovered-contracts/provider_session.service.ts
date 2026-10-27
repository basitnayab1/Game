export type ProviderSessionStatus = 'CREATED' | 'ACTIVE' | 'EXPIRED' | 'FAILED' | 'CLOSED';
export interface ProviderSessionContext { userId:string; gameId:string; providerId:string; sessionId:string; region:string; createdAt:string; expiresAt:string; }
export function createProviderSessionContext(input: Omit<ProviderSessionContext,'createdAt'>): ProviderSessionContext { return {...input, createdAt:new Date().toISOString()}; }
