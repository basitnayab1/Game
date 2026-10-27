# N5 Part 40 — API Integration Layer

Shared backend integration foundation for the final consolidation pass.

Includes:
- consistent API success/error envelope types
- async route wrapper
- request-ID propagation
- central v1 route map

This is intentionally not the final application wiring. During final integration, existing controllers/services will be mounted behind authentication, validation, rate limiting and authorization middleware; duplicate/temporary routes will be removed; then typecheck, unit, widget and integration smoke tests will be run.

Financial, KYC, security and provider webhooks remain server-authoritative.
