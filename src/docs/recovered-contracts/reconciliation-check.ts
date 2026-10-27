export type ReconciliationStatus='MATCHED'|'UNMATCHED'|'UNDER_REVIEW'|'RESOLVED';
export function compareAmounts(internalMinor: bigint, providerMinor: bigint): ReconciliationStatus { return internalMinor === providerMinor ? 'MATCHED' : 'UNMATCHED'; }
