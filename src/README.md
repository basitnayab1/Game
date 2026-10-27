# N5 Game — Final Source Code Package

This package is the recovered and canonically assembled N5 Game player-app/backend source package.

## Included
- Flutter/Dart player app
- Node.js/TypeScript backend foundation and API contracts
- PostgreSQL migration set
- Security, wallet/ledger, payment, game-provider, KYC, rewards, VIP, referral, support, responsible-gaming and recovery foundations
- English, Turkish, Hindi, Urdu and Arabic language scope
- Developer handover/build/release documentation

## Important status
This is the **final source-code handover package**, not a claim that the production deployment has already been certified. Flutter/Dart is not installed in the build environment used to assemble this archive, and backend dependency installation timed out there. Therefore the developer/CI environment must run the actual Flutter and backend build/test gates documented in `docs/DEVELOPER_HANDOVER_CHECKLIST.md`.

Production payment, game-provider, KYC, OTP/notification services, credentials, contracts, licensing and applicable jurisdiction/platform approvals remain external requirements.

## Canonical rules
- Final languages: `en`, `tr`, `hi`, `ur`, `ar`.
- Urdu and Arabic are RTL.
- Financial state is server/ledger authoritative.
- No real provider credentials are included.
- Customer funds must remain separate from platform revenue.
- No client-side action may manufacture financial success.

## First developer commands
```bash
cd player_app
flutter pub get
flutter analyze
flutter test
flutter build apk
```

Then:
```bash
cd ../backend
npm install
npm run typecheck
npm test
npm run build
```

See the `docs/` directory before production configuration.
