export interface RecoveryPlan { backupFrequency: string; retentionPolicy: string; restoreTestFrequency: string; recoveryOwner: string; }

export function validateRecoveryPlan(plan: RecoveryPlan): void {
  if (!plan.backupFrequency || !plan.retentionPolicy || !plan.restoreTestFrequency) throw new Error('Incomplete recovery plan');
}

