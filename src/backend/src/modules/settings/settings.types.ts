export type SupportedLocale = 'en' | 'tr' | 'hi' | 'ur' | 'ar';

export interface UserSettings {
  locale: SupportedLocale;
  notificationsEnabled: boolean;
  securityAlertsEnabled: boolean;
  biometricUnlockEnabled: boolean;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  locale: 'en',
  notificationsEnabled: true,
  securityAlertsEnabled: true,
  biometricUnlockEnabled: false,
};

export function isSupportedLocale(value: string): value is SupportedLocale {
  return ['en','tr','hi','ur','ar'].includes(value);
}
