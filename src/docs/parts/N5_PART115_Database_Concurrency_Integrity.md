# N5 Part 115 — Database Concurrency & Financial Integrity

This part establishes the executable contract for concurrent financial operations.

## Required production transaction order

1. BEGIN transaction.
2. Lock the target wallet row using `SELECT ... FOR UPDATE`.
3. Check the operation's unique idempotency key in the same transaction.
4. Validate the available balance and all server-side limits/eligibility.
5. Insert an immutable ledger entry.
6. Update the wallet/accounting state atomically.
7. Commit. On any error, rollback the complete transaction.

## Protected operations

- Deposits
- Withdrawals
- Rewards
- Reversals/compensating entries

## Important

This is a financial integrity foundation, not a complete payment or gambling-provider implementation. Production payment/game/KYC services remain dependent on authorized external providers and applicable licensing/regulatory requirements.

Never let the Flutter client set balances, fees, transaction status, or ledger entries.
