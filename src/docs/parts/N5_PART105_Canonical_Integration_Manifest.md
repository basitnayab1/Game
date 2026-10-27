# N5 Part 105 — Canonical Integration Manifest

Defines the single-source-of-truth map used during master consolidation.

## Rules
- `/api/v1` is the canonical API prefix.
- Player app uses one router, API client, and secure-storage implementation.
- Final supported locales are `en`, `tr`, `hi`, `ur`, `ar`.
- Backend remains authoritative for wallet, transaction, payment, KYC, security, reward and provider state.
- Provider/payment/KYC credentials are external secrets and are never committed to source.
- This part is an integration manifest, not a production real-money provider implementation.
