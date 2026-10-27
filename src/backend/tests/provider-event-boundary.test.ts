import { providerEventFinancialBoundary } from '../src/modules/webhooks/provider-event.store.contract.js';

describe('provider event financial boundary', () => {
  it('does not allow event recording to be treated as wallet credit', () => {
    expect(providerEventFinancialBoundary.eventRecordingMayNotCreditWallet).toBe(true);
    expect(providerEventFinancialBoundary.signatureMustBeVerifiedBeforeFinancialUse).toBe(true);
    expect(providerEventFinancialBoundary.providerAuthorizationRequired).toBe(true);
  });
});
