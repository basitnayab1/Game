# N5 Part 24 — Database Foundation

This is the database foundation for the N5 backend.

## Included
- PostgreSQL migration foundation
- Users and profiles
- Devices and sessions
- Wallet accounts
- Immutable-style ledger foundation
- UUID identifiers
- PKR minor-unit integer amounts
- Basic indexes and constraints

## Financial integrity
Wallet balances must never be changed directly from the player client.
Financial events are recorded through auditable ledger entries with
idempotency protection. Corrections should use a new compensating entry,
not deletion/editing of historical financial records.

## Important
This is an internal development part, not the final developer handover.
Payment/game-provider/KYC contracts and production credentials are external
dependencies and will be configured only through lawful/authorized services.
