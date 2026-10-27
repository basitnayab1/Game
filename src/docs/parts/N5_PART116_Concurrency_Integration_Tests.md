# N5 Part 116 — Concurrency Integration Tests

This part turns the Part 115 concurrency guard into an integration-test plan that must run against an isolated PostgreSQL test database before release.

## Required scenarios
- concurrent withdrawals on one wallet
- concurrent deposits
- duplicate idempotency keys
- concurrent reward claims
- repeated provider webhook delivery
- transaction rollback after an injected failure
- deadlock/lock-timeout handling

## Acceptance rules
1. Financial mutations execute inside a database transaction.
2. Wallet rows are locked/serialized where required.
3. Historical ledger entries are never updated or deleted.
4. Duplicate requests produce one financial effect.
5. A failed transaction leaves no partial balance mutation.
6. Final balance is derived from authoritative financial records.
7. Test runs use isolated test data and never production credentials.

Part 116 is an integration-test contract and SQL test-case package; it does not claim that the full N5 project has already passed these tests. The final merged project must execute them and record the results.
