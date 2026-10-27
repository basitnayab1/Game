# N5 Part 106 — Duplicate & Conflict Detection

Canonical merge verification rules for the N5 Player App.

## Detect
- Duplicate route registrations
- Duplicate API clients
- Duplicate secure-storage implementations
- Duplicate feature screens
- Conflicting locale lists
- Conflicting API prefixes
- Conflicting financial state definitions
- Conflicting provider/payment contracts
- Legacy placeholder routes/files

## Resolution
The canonical integration manifest wins. Duplicates are merged or removed; they are not silently kept as competing implementations.

## Safety
Financial, authentication, KYC, provider and security authority remains server-side. Production credentials are excluded.
