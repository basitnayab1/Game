# N5 Part 107 — Canonical Backend Module Registry

Final merge authority for backend modules. Each domain must have one canonical implementation.

- auth
- users
- wallet
- transactions
- payments
- withdrawals
- games
- promotions
- rewards
- vip
- referral
- agent
- kyc
- security
- notifications
- support
- settings
- responsible_gaming
- account_closure
- webhooks
- idempotency
- reconciliation
- audit

Rules:
- API prefix: `/api/v1`
- Financial state changes are server-authoritative.
- Provider callbacks require verification and idempotency.
- No production credentials in source control.
