export type AdminRole = 'admin' | 'super_admin';
export type ConfigValueType = 'boolean' | 'string' | 'number' | 'json';

export interface AdminConfigEntry {
  key: string;
  value: unknown;
  valueType: ConfigValueType;
  sensitive: boolean;
  version: number;
  updatedBy?: string;
  updatedAt?: string;
}

export interface AdminConfigRepository {
  list(): Promise<AdminConfigEntry[]>;
  get(key: string): Promise<AdminConfigEntry | null>;
  upsert(input: { key: string; value: unknown; valueType: ConfigValueType; sensitive?: boolean; updatedBy: string }): Promise<AdminConfigEntry>;
}

export const SAFE_ADMIN_CONFIG_KEYS = Object.freeze([
  'maintenance_mode',
  'announcement_text',
  'default_locale',
  'supported_locales',
  'support_url',
  'responsible_gaming_url',
  'feature.promotions',
  'feature.referrals',
  'feature.vip',
  'feature.agent',
  'feature.notifications',
]);

export function isSafeAdminConfigKey(key: string): boolean {
  return SAFE_ADMIN_CONFIG_KEYS.includes(key as (typeof SAFE_ADMIN_CONFIG_KEYS)[number]);
}
