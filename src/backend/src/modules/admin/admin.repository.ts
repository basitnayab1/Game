import { DatabaseClient } from '../../core/database/database.types.js';
import { AdminConfigEntry, AdminConfigRepository, ConfigValueType } from './admin.types.js';

export class PostgresAdminConfigRepository implements AdminConfigRepository {
  constructor(private readonly db: DatabaseClient) {}

  async list(): Promise<AdminConfigEntry[]> {
    const result = await this.db.query<any>(`SELECT config_key, value_json, value_type, sensitive, version, updated_by, updated_at FROM admin_config_entries ORDER BY config_key ASC`);
    return result.rows.map(this.mapRow);
  }

  async get(key: string): Promise<AdminConfigEntry | null> {
    const result = await this.db.query<any>(`SELECT config_key, value_json, value_type, sensitive, version, updated_by, updated_at FROM admin_config_entries WHERE config_key = $1`, [key]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async upsert(input: { key: string; value: unknown; valueType: ConfigValueType; sensitive?: boolean; updatedBy: string }): Promise<AdminConfigEntry> {
    const result = await this.db.query<any>(`
      INSERT INTO admin_config_entries (config_key, value_json, value_type, sensitive, updated_by)
      VALUES ($1, $2::jsonb, $3, $4, $5)
      ON CONFLICT (config_key) DO UPDATE SET
        value_json = EXCLUDED.value_json,
        value_type = EXCLUDED.value_type,
        sensitive = EXCLUDED.sensitive,
        updated_by = EXCLUDED.updated_by,
        version = admin_config_entries.version + 1,
        updated_at = now()
      RETURNING config_key, value_json, value_type, sensitive, version, updated_by, updated_at`,
      [input.key, JSON.stringify(input.value), input.valueType, Boolean(input.sensitive), input.updatedBy]);
    return this.mapRow(result.rows[0]);
  }

  private mapRow(row: any): AdminConfigEntry {
    return { key: row.config_key, value: row.value_json, valueType: row.value_type, sensitive: row.sensitive, version: Number(row.version), updatedBy: row.updated_by ?? undefined, updatedAt: row.updated_at?.toISOString?.() ?? String(row.updated_at ?? '') };
  }
}
