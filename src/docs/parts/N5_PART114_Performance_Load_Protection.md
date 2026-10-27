# N5 Part 114 — Performance & Load Protection

This part defines a performance guard for the live N5 architecture.

## Goals
- Prevent unbounded API/database requests.
- Use bounded pagination instead of returning huge datasets.
- Define practical response-time budgets for monitoring and load testing.
- Keep financial operations atomic; performance optimizations must never bypass ledger, idempotency, authorization, or audit controls.
- Prefer caching only for non-authoritative/read-heavy data such as game catalog, FAQ and static configuration where appropriate.
- Never cache wallet balances, withdrawal status, KYC status, or other security/financial state as authoritative data.

## Production checks
- Database indexes must be reviewed with query plans.
- Connection pools must be sized for the actual deployment.
- Slow-query monitoring must be enabled.
- API rate limits and request timeouts must be configured.
- Load tests must cover concurrent login, catalog browsing, wallet reads, deposits/withdrawals, webhooks and game-launch requests.
- Autoscaling or additional backend capacity should be used when measured traffic requires it.

The budgets in this file are engineering targets, not guarantees. They must be validated against real infrastructure and provider latency.
