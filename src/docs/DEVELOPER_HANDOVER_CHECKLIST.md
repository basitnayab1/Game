# N5 Game — Developer Handover Checklist

This package is the canonical N5 player-app/backend source assembly. It is source-ready, but production verification must be performed in a real Flutter/Android and backend environment.

## 1. Player App
- Install the supported Flutter/Dart SDK.
- Run `flutter pub get`.
- Run `flutter analyze`.
- Run `flutter test`.
- Build the Android application.
- Test on a physical Android device.
- Verify splash → onboarding → authentication → home navigation.
- Verify wallet, games, rewards, VIP, referral, KYC, security, support, settings, responsible gaming and account closure flows.
- Verify Urdu and Arabic RTL behavior.

## 2. Backend
- Run `npm install` in `backend/`.
- Configure `backend/.env` from `backend/.env.example`.
- Run `npm run typecheck`.
- Run `npm test`.
- Run `npm run build`.

## 3. Database
- Review `database/migrations/MIGRATION_ORDER.md`.
- Apply migrations to a staging PostgreSQL database.
- Run migration/recovery/concurrency checks.
- Verify backups and restore procedure.

## 4. External Services
Production payment, game-provider, KYC/identity, OTP/notification and storage services must be supplied through authorized contracts/accounts and configured with production secrets outside the source tree.

## 5. Security
- Never commit `.env` files containing real secrets.
- Use HTTPS/TLS in deployment.
- Keep PostgreSQL/Redis private.
- Verify provider webhook signatures.
- Keep financial state server/ledger authoritative.
- Do not use screenshots or client-side values to declare payment success.

## 6. Release Gate
Do not label the deployment production-ready until the actual Flutter build, backend tests/build, database migrations, staging provider tests, security checks and physical-device tests pass.
