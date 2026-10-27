# N5 Game — Final Build Gates

| Gate | Current environment | Required final result |
|---|---|---|
| Dart/Flutter SDK | Not installed | PASS |
| Flutter analyze | Not executable here | PASS |
| Flutter tests | Not executable here | PASS |
| Android build | Not executable here | PASS |
| Backend TypeScript syntax/static | Global `tsc` available | PASS after dependencies are installed |
| Backend dependencies | npm install timed out here | PASS |
| Backend tests | Blocked until dependencies installed | PASS |
| PostgreSQL migrations | Source present; runtime DB required | PASS |
| Physical Android test | Requires developer device | PASS |
| Authorized provider sandbox | External | PASS |

The package must not be represented as a fully production-certified deployment until these gates are actually passed.

## Current API router integration gate
The canonical Express router currently mounts:
- `/health`
- `/auth/*`
- `/users/me`
- authenticated `GET /wallet` read boundary

Deposit, withdrawal, game-launch, payment-webhook and other provider/financial mutations are intentionally **not mounted as production endpoints** until their database repositories, authorized provider contracts, idempotency/reconciliation paths, and legal/compliance configuration are connected and tested.

