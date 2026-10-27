export type GameEventState = 'RECEIVED' | 'VERIFIED' | 'DUPLICATE' | 'REJECTED' | 'FAILED';
export interface GameProviderEvent { providerId:string; eventId:string; eventType:string; sessionId:string; signature:string; payload:unknown; receivedAt:string; }
export function basicEventEnvelopeValid(e:GameProviderEvent): boolean { return !!e.providerId && !!e.eventId && !!e.eventType && !!e.sessionId && !!e.signature; }
