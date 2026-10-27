import { DEFAULT_USER_SETTINGS, UserSettings, SupportedLocale, isSupportedLocale } from './settings.types';

// Persistence adapter is intentionally injected later when the application DB layer is wired.
export interface SettingsRepository {
  get(userId: string): Promise<UserSettings | null>;
  save(userId: string, settings: UserSettings): Promise<UserSettings>;
}

export class SettingsService {
  constructor(private readonly repo: SettingsRepository) {}

  async get(userId: string): Promise<UserSettings> {
    return (await this.repo.get(userId)) ?? DEFAULT_USER_SETTINGS;
  }

  async update(userId: string, patch: Partial<UserSettings>): Promise<UserSettings> {
    const current = await this.get(userId);
    if (patch.locale !== undefined && !isSupportedLocale(patch.locale)) {
      throw new Error('Unsupported locale');
    }
    return this.repo.save(userId, { ...current, ...patch });
  }
}
