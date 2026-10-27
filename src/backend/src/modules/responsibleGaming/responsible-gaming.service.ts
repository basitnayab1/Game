import { ResponsibleGamingControls } from './responsible-gaming.types';

export interface ResponsibleGamingRepository {
  get(userId: string): Promise<ResponsibleGamingControls>;
  save(userId: string, controls: ResponsibleGamingControls): Promise<ResponsibleGamingControls>;
}

export class ResponsibleGamingService {
  constructor(private readonly repo: ResponsibleGamingRepository) {}

  async get(userId: string) { return this.repo.get(userId); }

  async update(userId: string, patch: Partial<ResponsibleGamingControls>) {
    const current = await this.repo.get(userId);
    const allowed = ['sessionReminderMinutes', 'depositLimitMinor', 'lossLimitMinor', 'takeABreakUntil', 'selfExcludedUntil'] as const;
    for (const key of Object.keys(patch)) {
      if (!(allowed as readonly string[]).includes(key)) throw new Error(`Unsupported responsible gaming field: ${key}`);
    }
    if (patch.sessionReminderMinutes !== undefined && patch.sessionReminderMinutes !== null) {
      if (!Number.isInteger(patch.sessionReminderMinutes) || patch.sessionReminderMinutes < 5 || patch.sessionReminderMinutes > 1440) {
        throw new Error('Invalid session reminder');
      }
    }
    for (const value of [patch.depositLimitMinor, patch.lossLimitMinor]) {
      if (value !== undefined && value !== null && (!Number.isInteger(value) || value < 0)) {
        throw new Error('Invalid responsible gaming limit');
      }
    }
    return this.repo.save(userId, { ...current, ...patch });
  }
}
