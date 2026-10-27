# N5 QA Repair Notes — Post QA2

This source package addresses the blockers reported by external QA for `N5_GAME_REPAIRED_EXTERNAL_QA2.zip`.

## Flutter
- Added `lib/features/vip/presentation/vip_models.dart` with the canonical VIP 1–20 navigation/detail model.
- Exported/imported the model explicitly in the VIP detail screen and app router.
- VIP live progress, eligibility and reward values remain server-authoritative; the static model is only for route/detail structure.

## Backend
- Fixed Agent and Referral controller context helpers so failed auth/database branches return `null` instead of leaking an Express `Response` into the context union.
- Added `@types/bcryptjs` to backend development dependencies to satisfy strict TypeScript compilation.

## Verification limitation
This environment does not have Flutter/Dart SDK and could not complete `npm install` within the available execution window. The repaired package therefore requires the external Flutter/Node verification environment for the authoritative build/test result.
