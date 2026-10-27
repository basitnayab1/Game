import { describe, expect, it } from 'vitest';
import { ADMIN_BOUNDARY_RULES, ADMIN_CONFIG_ROUTES } from '../src/modules/admin/admin.route.contract.js';
import { SAFE_ADMIN_CONFIG_KEYS, isSafeAdminConfigKey } from '../src/modules/admin/admin.types.js';

describe('admin foundation boundary', () => {
  it('defines authenticated admin-only config routes', () => {
    expect(ADMIN_CONFIG_ROUTES.list).toBe('GET /admin/config');
    expect(ADMIN_CONFIG_ROUTES.update).toBe('PATCH /admin/config');
    expect(ADMIN_BOUNDARY_RULES.requiresAuthenticatedAdminRole).toBe(true);
  });
  it('never exposes direct wallet/outcome mutation', () => {
    expect(ADMIN_BOUNDARY_RULES.allowsDirectWalletBalanceEdit).toBe(false);
    expect(ADMIN_BOUNDARY_RULES.allowsOutcomeManipulation).toBe(false);
    expect(ADMIN_BOUNDARY_RULES.allowsSecretStorageInConfigTable).toBe(false);
  });
  it('allow-lists only safe configuration keys', () => {
    expect(SAFE_ADMIN_CONFIG_KEYS.length).toBe(11);
    expect(isSafeAdminConfigKey('maintenance_mode')).toBe(true);
    expect(isSafeAdminConfigKey('wallet.balance')).toBe(false);
    expect(isSafeAdminConfigKey('provider.secret')).toBe(false);
  });
});
