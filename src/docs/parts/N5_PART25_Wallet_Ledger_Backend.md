# N5 Part 25 — Wallet + Ledger Backend

## Purpose
Backend foundation for wallet reads and financially safe ledger operations.

## Rules
- Player/client cannot directly set wallet balances.
- Financial amounts use integer minor units.
- Ledger entries are historical records.
- Corrections use compensating entries rather than editing/deleting history.
- Financial mutations require database transactions and row locking.
- Idempotency prevents duplicate financial processing.
- Ownership comes from the authenticated session, not a client-supplied user ID.
- Payment/provider callbacks must be verified before money is credited.
- Production payment/game-provider integrations require authorized services and applicable contracts/licensing.

## Included
- Wallet domain validation
- Wallet read controller foundation
- Ledger integrity rules
- Database indexes/constraints

This is an internal development part, not the final developer handover.
