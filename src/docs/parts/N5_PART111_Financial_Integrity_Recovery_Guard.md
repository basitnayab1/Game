# N5 Part 111 — Financial Integrity & Recovery Guard

Purpose: define the canonical safety boundary for live financial actions.

## Rules
- Customer wallet state is server-authoritative.
- Financial mutations require an idempotency key and atomic transaction boundary.
- A client retry must never create a second financial mutation.
- Provider callbacks are verified before financial posting.
- Unknown/duplicate callbacks are not posted again.
- Reversals use compensating ledger entries; historical entries are not edited/deleted.
- Deposit/withdrawal status is reconciled against authorized provider records.
- Pending states survive app restarts and network loss.
- The app never declares a financial action successful solely from local state.
- Fee and net amounts are calculated/returned by the server.

## Recovery scenarios
1. Request sent, response lost -> query transaction by idempotency key.
2. Provider callback repeated -> deduplicate by provider event ID.
3. Provider callback delayed -> keep transaction pending until verified.
4. App killed during payment -> restore transaction status from backend.
5. Provider failure after initiation -> preserve auditable failed/reversed state.
6. Reconciliation mismatch -> hold for review; never silently alter balances.

This is an architecture/verification contract. Production payment rails require authorized provider integrations and applicable legal/licensing arrangements.
