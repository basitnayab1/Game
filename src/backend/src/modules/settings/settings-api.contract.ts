export type SupportedLocale = 'en' | 'tr' | 'hi' | 'ur' | 'ar';

export interface UserSettingsResponse {
  locale: SupportedLocale;
  notificationsEnabled: boolean;
  securityAlertsEnabled: boolean;
  biometricUnlockEnabled: boolean;
}

export interface UpdateUserSettingsRequest {
  locale?: SupportedLocale;
  notificationsEnabled?: boolean;
  securityAlertsEnabled?: boolean;
  biometricUnlockEnabled?: boolean;
}

export function assertSupportedLocale(locale: string): asserts locale is SupportedLocale {
  const supported: SupportedLocale[] = ['en', 'tr', 'hi', 'ur', 'ar'];
  if (!supported.includes(locale as SupportedLocale)) throw new Error('Unsupported locale');
}
