# N5 — Next 3 Finalization Gates

## 1. Wallet read safety
- Wallet ownership comes only from the authenticated session.
- Client-supplied user IDs must never select another wallet.
- Wallet responses use PKR integer minor units and non-negative amounts.
- A zero balance must not be used as a fake production fallback when the wallet repository is unavailable.
- Financial writes remain server/ledger authoritative.

## 2. Game launch recovery
- A launch session must contain valid session/game/provider IDs.
- Expired or closed sessions cannot be treated as active.
- Network timeout/provider-unavailable/session-expiry failures are retryable through a fresh server/provider session.
- Eligibility failures are not blindly retried.
- The player app never decides game outcomes.

## 3. Reward claim safety
- Every reward claim requires a server-side idempotency key.
- Eligibility and claim window are server authoritative.
- Duplicate claims are rejected.
- Wallet posting requires explicit server-side authorization and must occur through the authoritative ledger.

These are domain guards/contracts. They do not replace PostgreSQL persistence, provider credentials, licensing, or staging tests.

## Tests added
- `tests/next3/wallet-read.guard.test.ts`
- `tests/next3/game-launch.guard.test.ts`
- `tests/next3/reward-claim.guard.test.ts`

These tests are Node/TypeScript test sources. They still require the backend's configured TypeScript test runner/dependencies for execution; this environment does not currently have the complete backend dependency installation.
