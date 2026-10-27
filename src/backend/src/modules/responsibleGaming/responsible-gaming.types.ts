export interface ResponsibleGamingControls {
  sessionReminderMinutes: number | null;
  depositLimitMinor: number | null;
  lossLimitMinor: number | null;
  takeABreakUntil: Date | null;
  selfExcludedUntil: Date | null;
}

export type ResponsibleGamingAction =
  | 'SET_SESSION_REMINDER'
  | 'SET_DEPOSIT_LIMIT'
  | 'SET_LOSS_LIMIT'
  | 'TAKE_A_BREAK'
  | 'SELF_EXCLUSION';
