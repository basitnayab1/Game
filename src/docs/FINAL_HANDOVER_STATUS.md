# N5 Game — Final Handover Candidate

This directory is the current canonical source assembly candidate built from the available N5 source archives and the latest player integration patches.

## Final scope
- Flutter/Dart player app
- Node.js/TypeScript backend
- PostgreSQL migration/schema foundation
- Redis/infrastructure contracts
- API contracts and security/recovery foundations
- English, Turkish, Hindi, Urdu, Arabic
- 40-screen player experience and major feature flows

## Important external dependencies
Production payment, game-provider, KYC/identity, OTP/notification services, applicable licenses/contracts, and production credentials are external operator/provider responsibilities. They are intentionally not embedded in source code.

## Verification status
Static source assembly and archive integrity can be checked in this environment. Flutter/Dart SDK is not installed here, so `flutter analyze`, `flutter test`, and Android release builds cannot be truthfully marked PASS here. The developer/CI environment must execute those gates.

Backend Node/npm checks also require installing dependencies and running the project's configured test/typecheck/build commands.

## Financial authority
Wallet balances, transaction status, withdrawal fee/net amount, provider callbacks, rewards and other financial mutations are server/ledger authoritative. The player app must never manufacture financial success.

## Handover
Use this candidate as the basis for the developer handover after the final automated/static checks below pass and any developer-environment compile issues are resolved.
