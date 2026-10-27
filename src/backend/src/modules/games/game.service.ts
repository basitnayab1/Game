import type { GameLaunchContext, ProviderAdapter } from "./provider.types";

export function normalizeSearchQuery(value?: string): string {
  return (value ?? "").trim().slice(0, 80);
}

export async function createGameLaunch(
  adapter: ProviderAdapter,
  context: GameLaunchContext,
) {
  // Eligibility/region/session checks belong here before provider launch.
  return adapter.createLaunchSession(context);
}
