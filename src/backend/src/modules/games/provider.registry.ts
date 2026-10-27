import type { ProviderAdapter } from "./provider.types";

/** Provider registry. Concrete provider adapters are configured later. */
const adapters = new Map<string, ProviderAdapter>();

export function registerProvider(id: string, adapter: ProviderAdapter) {
  if (!id) throw new Error("provider id required");
  adapters.set(id, adapter);
}

export function getProvider(id: string): ProviderAdapter {
  const adapter = adapters.get(id);
  if (!adapter) throw new Error("provider not configured");
  return adapter;
}

export function hasProvider(id: string): boolean {
  if (!id) return false;
  return adapters.has(id);
}

export function clearProviders(): void {
  adapters.clear();
}
