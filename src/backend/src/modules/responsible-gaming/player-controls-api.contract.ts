export interface ResponsibleGamingControls {
  sessionReminderMinutes?: number;
  depositLimitMinor?: number;
  lossLimitMinor?: number;
  takeABreakUntil?: string;
  selfExclusionUntil?: string;
}

export interface UpdateResponsibleGamingRequest {
  sessionReminderMinutes?: number;
  depositLimitMinor?: number;
  lossLimitMinor?: number;
  takeABreakUntil?: string | null;
  selfExclusionUntil?: string | null;
}

export type AccountClosureStatus =
  | 'REQUESTED'
  | 'SECURITY_REVIEW'
  | 'PENDING_OBLIGATIONS'
  | 'PROCESSING'
  | 'CLOSED'
  | 'REJECTED'
  | 'CANCELLED';

export interface AccountClosureResponse {
  requestId: string;
  status: AccountClosureStatus;
  createdAt: string;
}

export function validatePositiveLimit(value?: number): void {
  if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
    throw new Error('Invalid limit');
  }
}
