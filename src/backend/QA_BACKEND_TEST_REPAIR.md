# N5 Backend Test Repair Notes — 2026-10-09

## Changes made in this repair copy

1. Added `vitest.config.ts` with explicit test discovery for both `backend/test/**/*.test.ts` and `backend/tests/**/*.test.ts`.
2. Enabled Vitest globals to support existing tests using `describe`, `it`, `test`, and `expect` without imports.
3. Wrapped contract assertions that previously ran at module top-level in Vitest `test()` blocks. This addresses the “No test suite found” class without deleting assertions or disabling tests.
4. Converted the Admin VIP contract test from `node:test` to Vitest so the project uses one runner.
5. Corrected several known path errors in migration and Flutter contract tests.
6. Added actual tests for the integration acceptance checklist helper.

## Verification performed in this environment

- Project static audit: PASS — 70 Dart files, 165 backend TypeScript files, 33 database migrations; no missing relative imports; final languages en/tr/hi/ur/ar; no legacy placeholder hits according to the existing static audit script.
- NPM dependency install: BLOCKED — `npm install` timed out in this environment. No local `node_modules/vitest` is available, so Vitest could not execute here.
- Backend typecheck/build/tests: NOT VERIFIED in this repair copy after edits. Earlier reports from another run are not evidence that this changed copy passes.
- Flutter Android APK/AAB: NOT VERIFIED here; this environment has no Flutter/Dart SDK installed.
- Admin build: NOT VERIFIED; its dependency install must be retried on a stable network.

## Developer verification commands

Run from the project root:

```bash
cd backend
npm install
npm run typecheck
npm test -- --reporter=verbose
npm run build
cd ../admin
npm install
npm run build
```

Run Flutter checks from the project root (where `pubspec.yaml` exists):

```bash
flutter clean
flutter pub get
flutter analyze
flutter test
flutter build apk --debug
flutter build apk --release
flutter build appbundle --release
flutter build web
```

If any test still fails, retain the exact failing test name, stack trace, Node/npm versions, and working directory. Do not remove/skip failing assertions to obtain a green report. Check the full fee/withdrawal and game-provider requirements with the product owner before any production release.
