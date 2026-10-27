export interface GameProviderConfig {
  id: string;
  name: string;
  enabled: boolean;
  baseUrl?: string;
  externalProviderId?: string;
}

export interface GameLaunchContext {
  userId: string;
  gameId: string;
  locale: string;
  region?: string;
  deviceId?: string;
}

export interface ProviderAdapter {
  getCatalog(): Promise<unknown[]>;
  createLaunchSession(context: GameLaunchContext): Promise<{ launchUrl: string; sessionId: string }>;
  verifyWebhook(signature: string, rawBody: string): boolean;
}

export const providerRules = Object.freeze({
  onlyAuthorizedProviders: true,
  secretsServerSideOnly: true,
  signedWebhooksRequired: true,
  providerAssetsMustBeAuthorized: true,
  launchEligibilityServerSide: true,
});
