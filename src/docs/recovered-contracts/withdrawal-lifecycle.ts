export type WithdrawalStatus = 'PENDING'|'UNDER_REVIEW'|'APPROVED'|'PROCESSING'|'COMPLETED'|'REJECTED'|'FAILED'|'REVERSED';
const transitions: Record<WithdrawalStatus, WithdrawalStatus[]> = {
 PENDING:['UNDER_REVIEW','REJECTED','CANCELLED' as WithdrawalStatus], UNDER_REVIEW:['APPROVED','REJECTED'], APPROVED:['PROCESSING','REJECTED'], PROCESSING:['COMPLETED','FAILED','REVERSED'], COMPLETED:[], REJECTED:[], FAILED:[], REVERSED:[], CANCELLED:[] as WithdrawalStatus[]
};
export function canTransition(from: WithdrawalStatus,to: WithdrawalStatus): boolean { return transitions[from]?.includes(to) ?? false; }
