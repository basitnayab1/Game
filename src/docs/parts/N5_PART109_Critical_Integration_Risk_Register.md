# N5 Part 109 — Critical Integration Risk Register

Purpose: identify and control issues that could cause developer handoff, merge, security, financial-integrity, or production-readiness problems.

## Critical gates
1. One canonical Flutter project and one backend project.
2. No duplicate router/API client/auth authority.
3. Final supported languages: en, tr, hi, ur, ar.
4. Financial state is server-authoritative; no client balance mutation.
5. Deposit credit only after authorized provider verification/webhook.
6. Withdrawal fee/status/net amount are server-generated.
7. All financial/reward callbacks require idempotency and auditability.
8. Provider/KYC/payment credentials are external secrets, never committed.
9. Production real-money functionality requires applicable licensing, contracts and authorized providers.
10. Final build/analyzer/type-check/tests must be run on the merged repository.

## Known pre-final risks
- Interim parts have not all been merged into one verified repository yet.
- Some earlier parts are contracts/foundations rather than complete production implementations.
- Provider/payment/KYC integrations depend on external authorized services.
- UI translation resources need final consolidation and review.
- Database migration chain needs one clean ordered sequence.
- Route/import/dependency conflicts must be resolved during merge.

## Acceptance rule
Do not label N5 as final developer-ready until every critical gate is checked against the merged repository and unresolved issues are documented.
