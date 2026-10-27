export type AccountClosureStatus = 'REQUESTED' | 'SECURITY_REVIEW' | 'PENDING_OBLIGATIONS' | 'PROCESSING' | 'CLOSED' | 'REJECTED' | 'CANCELLED';

export interface AccountClosureRequest {
  id: string;
  userId: string;
  status: AccountClosureStatus;
  reasonCode: string | null;
  requestedAt: Date;
  closedAt: Date | null;
}
