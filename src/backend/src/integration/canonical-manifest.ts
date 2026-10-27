export const canonicalIntegrationManifest = {
  apiPrefix: '/api/v1',
  playerApp: {
    router: 'core/routing/app_router.dart',
    apiClient: 'core/networking/api_client.dart',
    secureStorage: 'core/storage/secure_storage.dart',
    locales: ['en', 'tr', 'hi', 'ur', 'ar'],
  },
  backend: {
    auth: 'modules/auth',
    wallet: 'modules/wallet',
    payments: 'modules/payments',
    games: 'modules/games',
    rewards: 'modules/rewards',
    kyc: 'modules/kyc',
    security: 'modules/security',
    support: 'modules/support',
  },
  financialAuthority: 'backend',
  providerCredentials: 'external-secret-management',
} as const;
