export const ADMIN_CONFIG_ROUTES = Object.freeze({
  list: 'GET /admin/config',
  update: 'PATCH /admin/config',
});

export const ADMIN_BOUNDARY_RULES = Object.freeze({
  requiresAuthenticatedAdminRole: true,
  allowsDirectWalletBalanceEdit: false,
  allowsOutcomeManipulation: false,
  allowsSecretStorageInConfigTable: false,
  requiresVersionedConfig: true,
  requiresAuditEventForMutation: true,
});
