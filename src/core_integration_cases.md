# N5 Part 68 — Core Financial/Game Integration Test Cases
Smoke/integration cases:
1. Authenticated user context is required for wallet mutations.
2. Duplicate provider event does not create a second posting.
3. Unverified provider signature is rejected.
4. Deposit remains pending until authorized provider verification.
5. Withdrawal cannot exceed authoritative available balance.
6. Withdrawal is blocked/reviewed when required KYC/payment-ownership/risk checks fail.
7. Reward claim is idempotent.
8. Self-excluded/ineligible accounts cannot receive restricted reward postings.
9. Ledger history is append-only; corrections use compensating entries.
10. Reconciliation mismatch becomes review state rather than silent balance adjustment.
