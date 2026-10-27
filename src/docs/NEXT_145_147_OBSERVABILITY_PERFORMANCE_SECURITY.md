# N5 Next 145–147 — Observability, Performance & Security

## 145 — Runtime observability
- Request IDs and non-sensitive structured HTTP timing telemetry.
- Runtime request/error counters exposed through the health response.
- Request bodies, tokens, passwords and payment credentials must never be logged.

## 146 — Performance protection
- JSON body limit remains bounded at 1 MB.
- Sensitive endpoints have a process-local rate-limit foundation.
- Production must use a shared Redis-backed limiter when multiple backend instances are deployed.
- Pagination, DB indexes, query timeouts and connection-pool limits remain required at the database layer.

## 147 — Security release gate
- Helmet and x-powered-by protection enabled.
- Explicit production CORS origin required.
- Production API prefix is `/api/v1`.
- Production secrets must come from environment/secret management, never source control.
- Sensitive telemetry must remain redacted.
- Flutter/API clients must never contain provider private secrets.

This package is a source-level gate. It does not prove production security or performance until the complete stack is load-tested and deployed in a controlled staging environment.
