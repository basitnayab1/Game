import { AccountClosureRequest } from './account-closure.types';

export interface AccountClosureRepository {
  create(userId: string, reasonCode: string | null): Promise<AccountClosureRequest>;
  getOpen(userId: string): Promise<AccountClosureRequest | null>;
  updateStatus(id: string, status: AccountClosureRequest['status']): Promise<AccountClosureRequest>;
}

export interface AccountClosureGate {
  requireRecentSecurityVerification(userId: string): Promise<void>;
  getPendingObligations(userId: string): Promise<{ pendingTransactions: number; openSupportCases: number }>;
}

export class AccountClosureService {
  constructor(private readonly repo: AccountClosureRepository, private readonly gate: AccountClosureGate) {}

  async request(userId: string, reasonCode: string | null) {
    await this.gate.requireRecentSecurityVerification(userId);
    const existing = await this.repo.getOpen(userId);
    if (existing) return existing;
    const obligations = await this.gate.getPendingObligations(userId);
    if (obligations.pendingTransactions > 0 || obligations.openSupportCases > 0) {
      throw new Error('Account has pending obligations and cannot be closed yet');
    }
    return this.repo.create(userId, reasonCode);
  }

  async cancel(userId: string) {
    await this.gate.requireRecentSecurityVerification(userId);
    const existing = await this.repo.getOpen(userId);
    if (!existing) throw new Error('No open closure request');
    return this.repo.updateStatus(existing.id, 'CANCELLED');
  }
}
