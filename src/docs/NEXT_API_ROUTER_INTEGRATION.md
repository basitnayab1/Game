# N5 API Router Integration Update

## Change
The canonical Express API router now mounts the implemented/authenticated boundaries:

- `GET /api/v1/health/*`
- `/api/v1/auth/*`
- `GET /api/v1/users/me`
- `GET /api/v1/wallet` (authenticated, fail-closed until production DB repository is configured)

## Deliberately not mounted as live production mutations
- deposits
- withdrawals
- payment webhooks
- game/provider launch
- provider settlement
- other financial/provider mutations

Those modules remain source-level contracts/foundations until authorized provider contracts, production repositories, idempotency, reconciliation, compliance and runtime tests are connected.

## Verification performed in this environment
- Relative TypeScript import audit: 0 missing relative imports.
- Flutter/Dart compile: not run; Flutter/Dart SDK is unavailable in this environment.
- Backend TypeScript build: not declared passed; npm dependencies/runtime build environment are not available here.
