import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { createDatabaseClient } from '../core/database/postgres.client.js';
import type { DatabaseClient } from '../core/database/database.types.js';

export interface BootstrapAdminOptions {
  phone: string;
  password?: string;
  role?: string;
  name?: string;
  databaseUrl?: string;
  generatePasswordIfMissing?: boolean;
}

export interface BootstrapAdminResult {
  userId: string;
  phone: string;
  role: string;
  createdNewUser: boolean;
  generatedPassword?: string;
}

const INSECURE_DEFAULT_PASSWORDS = new Set([
  'securePassword123!',
  'Password123!',
  'password',
  'admin123',
  '12345678',
  'admin',
]);

export function validateAdminPhone(phone: string): void {
  const e164Regex = /^\+[1-9]\d{6,14}$/;
  if (!phone || !e164Regex.test(phone.trim())) {
    throw new Error('INVALID_PHONE: Admin phone must be in valid E.164 international format (e.g. +923001234567).');
  }
}

export function validateAdminPassword(password: string): void {
  if (!password || password.length < 12) {
    throw new Error('INVALID_PASSWORD: Admin password must be at least 12 characters long.');
  }
  if (INSECURE_DEFAULT_PASSWORDS.has(password)) {
    throw new Error('INSECURE_PASSWORD: Common default/sample passwords are strictly rejected for production admin accounts.');
  }
}

export function generateSecurePassword(): string {
  return randomBytes(18).toString('base64url') + '!A9';
}

export async function bootstrapAdminOperator(
  client: DatabaseClient,
  options: BootstrapAdminOptions,
): Promise<BootstrapAdminResult> {
  const phone = options.phone.trim();
  validateAdminPhone(phone);

  let password = options.password?.trim();
  let generatedPassword: string | undefined;

  if (!password) {
    if (options.generatePasswordIfMissing) {
      password = generateSecurePassword();
      generatedPassword = password;
    } else {
      throw new Error('MISSING_PASSWORD: ADMIN_PASSWORD environment variable or --password argument is required.');
    }
  }

  validateAdminPassword(password);
  const roleCode = options.role?.trim() || 'super_admin';
  const displayName = options.name?.trim() || 'N5 Authorized Admin';

  // Verify role exists in admin_roles
  const roleRes = await client.query<{ id: string; code: string }>(
    'SELECT id, code FROM admin_roles WHERE code = $1 LIMIT 1;',
    [roleCode],
  );
  if (roleRes.rows.length === 0) {
    throw new Error(`INVALID_ROLE: Role "${roleCode}" does not exist in admin_roles table.`);
  }
  const roleId = roleRes.rows[0].id;

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS || 12);

  return client.transaction(async (tx) => {
    // Check if user exists
    const userRes = await tx.query<{ id: string }>(
      'SELECT id FROM users WHERE phone_e164 = $1 LIMIT 1;',
      [phone],
    );

    let userId: string;
    let createdNewUser = false;

    if (userRes.rows.length > 0) {
      userId = userRes.rows[0].id;
      await tx.query(
        `UPDATE users
         SET password_hash = $1, status = 'active', phone_verified_at = COALESCE(phone_verified_at, now()), updated_at = now()
         WHERE id = $2;`,
        [passwordHash, userId],
      );
    } else {
      userId = randomUUID();
      createdNewUser = true;
      await tx.query(
        `INSERT INTO users (id, phone_e164, date_of_birth, password_hash, status, phone_verified_at, created_at, updated_at)
         VALUES ($1, $2, '1990-01-01', $3, 'active', now(), now(), now());`,
        [userId, phone, passwordHash],
      );
    }

    // Ensure profile
    await tx.query(
      `INSERT INTO user_profiles (user_id, display_name, country_code, language_code, created_at, updated_at)
       VALUES ($1, $2, 'PK', 'en', now(), now())
       ON CONFLICT (user_id) DO UPDATE SET display_name = $2, updated_at = now();`,
      [userId, displayName],
    );

    // Enforce 2-operator limit from migration 030
    const countRes = await tx.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM admin_users WHERE status = 'active' AND user_id != $1;`,
      [userId],
    );
    const otherActiveCount = parseInt(countRes.rows[0]?.count || '0', 10);
    if (otherActiveCount >= 2) {
      throw new Error('N5_ADMIN_OPERATOR_LIMIT_REACHED: Database already has 2 active admin operators. Deactivate an existing operator first.');
    }

    // Link in admin_users
    await tx.query(
      `INSERT INTO admin_users (user_id, role_id, status, created_at, updated_at)
       VALUES ($1, $2, 'active', now(), now())
       ON CONFLICT (user_id) DO UPDATE SET role_id = $2, status = 'active', updated_at = now();`,
      [userId, roleId],
    );

    return {
      userId,
      phone,
      role: roleCode,
      createdNewUser,
      generatedPassword,
    };
  });
}

// CLI entrypoint
async function cli() {
  const args = process.argv.slice(2);
  const getArg = (prefix: string) => {
    const found = args.find((a) => a.startsWith(prefix));
    return found ? found.substring(prefix.length) : undefined;
  };

  const phone = getArg('--phone=') || process.env.ADMIN_PHONE;
  const password = getArg('--password=') || process.env.ADMIN_PASSWORD;
  const role = getArg('--role=') || process.env.ADMIN_ROLE || 'super_admin';
  const name = getArg('--name=') || process.env.ADMIN_NAME || 'N5 Super Admin';
  const dbUrl = getArg('--url=') || process.env.DATABASE_URL || env.DATABASE_URL;

  if (!dbUrl) {
    console.error('[BOOTSTRAP ERROR] DATABASE_URL is required.');
    process.exit(1);
  }

  if (!phone) {
    console.error('[BOOTSTRAP ERROR] ADMIN_PHONE environment variable or --phone argument is required.');
    console.error('Usage: ADMIN_PHONE="+923001234567" ADMIN_PASSWORD="<secure-pw>" npm run bootstrap:admin');
    process.exit(1);
  }

  const client = createDatabaseClient(dbUrl);

  try {
    const result = await bootstrapAdminOperator(client, {
      phone,
      password,
      role,
      name,
      generatePasswordIfMissing: true,
    });

    console.log(`[BOOTSTRAP SUCCESS] Admin operator successfully configured!`);
    console.log(`  -> User ID: ${result.userId}`);
    console.log(`  -> Phone:   ${result.phone}`);
    console.log(`  -> Role:    ${result.role}`);
    if (result.generatedPassword) {
      console.log(`  -> Generated Password: ${result.generatedPassword}`);
      console.log(`  [SECURITY NOTICE] Store this password securely now; it will not be displayed again.`);
    }
  } catch (error: any) {
    console.error(`[BOOTSTRAP FAILED] ${error.message}`);
    process.exit(1);
  } finally {
    await client.close().catch(() => {});
  }
}

if (process.argv[1] && (process.argv[1].endsWith('bootstrap-admin.ts') || process.argv[1].endsWith('bootstrap-admin.js'))) {
  cli().catch((err) => {
    console.error('[BOOTSTRAP UNCAUGHT]', err);
    process.exit(1);
  });
}
