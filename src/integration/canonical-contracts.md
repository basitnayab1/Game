# Part 102 — Canonical Integration Contracts

## Goal
Define one source of truth for shared player/backend contracts.

## Rules
- API routes use one versioned prefix: /api/v1.
- Auth/session state is backend-authoritative.
- Wallet balances and financial transaction states are backend-authoritative.
- Provider, payment and KYC credentials are never stored in the player app.
- Financial mutations require idempotency and server-side authorization.
- Duplicate legacy/mock contracts must be mapped to canonical contracts during the master merge.
- The final Flutter app must use one API client and one route registry.
- The final backend must use one module registry and one database migration chain.

## Integration checklist
1. Inventory duplicate files.
2. Select canonical implementation.
3. Update imports/references.
4. Remove obsolete duplicates.
5. Run formatter, analyzer/type-check and tests.
6. Record unresolved external dependencies separately.
