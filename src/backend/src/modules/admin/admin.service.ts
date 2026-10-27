import { AdminConfigEntry, AdminConfigRepository, ConfigValueType, isSafeAdminConfigKey } from './admin.types.js';

export class AdminConfigService {
  constructor(private readonly repo: AdminConfigRepository) {}

  async list(): Promise<AdminConfigEntry[]> {
    return this.repo.list();
  }

  async get(key: string): Promise<AdminConfigEntry | null> {
    if (!isSafeAdminConfigKey(key)) throw new Error('Unsupported admin configuration key');
    return this.repo.get(key);
  }

  async set(input: { key: string; value: unknown; valueType: ConfigValueType; sensitive?: boolean; updatedBy: string }): Promise<AdminConfigEntry> {
    if (!isSafeAdminConfigKey(input.key)) throw new Error('Unsupported admin configuration key');
    if (!input.updatedBy) throw new Error('updatedBy is required');
    this.validateValue(input.value, input.valueType);
    if (input.sensitive) throw new Error('Sensitive configuration requires a dedicated secret-management path');
    return this.repo.upsert({ ...input, sensitive: false });
  }

  private validateValue(value: unknown, type: ConfigValueType): void {
    if (type === 'boolean' && typeof value !== 'boolean') throw new Error('Expected boolean configuration value');
    if (type === 'string' && typeof value !== 'string') throw new Error('Expected string configuration value');
    if (type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) throw new Error('Expected finite number configuration value');
    if (type === 'json' && (value === undefined || typeof value === 'function')) throw new Error('Invalid JSON configuration value');
  }
}

export function createUnavailableAdminConfigRepository(): AdminConfigRepository {
  const unavailable = async () => { throw new Error('ADMIN_CONFIG_REPOSITORY_NOT_CONFIGURED'); };
  return { list: unavailable, get: unavailable, upsert: unavailable };
}
