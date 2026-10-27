export interface IntegrationCheck {
  name: string;
  required: boolean;
}

export const N5IntegrationChecks: IntegrationCheck[] = [
  { name: 'authentication requires a valid server-issued access token', required: true },
  { name: 'wallet responses are server-authoritative and PKR-only', required: true },
  { name: 'deposit remains pending until authorized provider verification', required: true },
  { name: 'withdrawal fee/status are generated server-side', required: true },
  { name: 'financial mutations require idempotency protection', required: true },
  { name: 'game launch requires an active/eligible backend game session', required: true },
  { name: 'reward claims cannot be duplicated', required: true },
  { name: 'KYC/security actions require authenticated user context', required: true },
  { name: 'responsible-gaming controls are backend-enforced', required: true },
  { name: 'account closure follows the server lifecycle', required: true },
];

export function requiredChecksPass(results: Record<string, boolean>): boolean {
  return N5IntegrationChecks
    .filter((check) => check.required)
    .every((check) => results[check.name] === true);
}


import { describe, expect, it } from 'vitest';

describe('integration acceptance checklist contract', () => {
  it('declares a non-empty set of required integration checks', () => {
    expect(N5IntegrationChecks.length).toBeGreaterThan(0);
    expect(N5IntegrationChecks.every((check) => check.required && check.name.length > 0)).toBe(true);
  });

  it('fails closed if any required integration check is missing or false', () => {
    expect(requiredChecksPass({})).toBe(false);
    const allPassing = Object.fromEntries(N5IntegrationChecks.map((check) => [check.name, true]));
    expect(requiredChecksPass(allPassing)).toBe(true);
    const oneFailing = { ...allPassing, [N5IntegrationChecks[0].name]: false };
    expect(requiredChecksPass(oneFailing)).toBe(false);
  });
});
