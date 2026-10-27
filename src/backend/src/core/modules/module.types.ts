export type ModuleRegistration = {
  name: string;
  version: string;
  enabled: boolean;
  dependencies?: string[];
};

export const coreModules: ModuleRegistration[] = [
  { name: 'auth', version: 'v1', enabled: true },
  { name: 'users', version: 'v1', enabled: true },
  { name: 'wallet', version: 'v1', enabled: true },
  { name: 'transactions', version: 'v1', enabled: true },
  { name: 'payments', version: 'v1', enabled: true },
  { name: 'games', version: 'v1', enabled: true },
  { name: 'promotions', version: 'v1', enabled: true },
  { name: 'rewards', version: 'v1', enabled: true },
  { name: 'kyc', version: 'v1', enabled: true },
  { name: 'security', version: 'v1', enabled: true },
  { name: 'notifications', version: 'v1', enabled: true },
  { name: 'support', version: 'v1', enabled: true },
  { name: 'responsible-gaming', version: 'v1', enabled: true },
  { name: 'account-closure', version: 'v1', enabled: true },
  { name: 'webhooks', version: 'v1', enabled: true },
];
