# N5 Part 104 — Canonical Merge Map

This part defines the authoritative merge map for consolidating the interim N5 player-app parts into one Flutter project.

## Canonical rules
- One `lib/main.dart` entry point.
- One GoRouter configuration under `lib/core/routing/`.
- One API client under `lib/core/networking/`.
- One secure-storage implementation under `lib/core/storage/`.
- One localization configuration with exactly: English (en), Turkish (tr), Hindi (hi), Urdu (ur), Arabic (ar).
- One canonical feature screen per route.
- Shared widgets belong under `lib/shared/widgets/`.
- Mock/demo data must remain clearly separated from production repositories/services.
- No provider credentials, payment secrets, KYC secrets, signing keys, or production tokens in source control.

## Merge order
1. Foundation and theme
2. Routing/navigation
3. Localization
4. Authentication/session
5. Wallet/statement/transactions
6. Deposit/withdrawal
7. Games/provider launch
8. Promotions/rewards/VIP/referral/agent
9. KYC/security
10. Notifications/support/FAQ
11. Responsible gaming/account closure/settings
12. Tests and cleanup

## Important
This is an integration map, not a claim that all prior interim ZIPs have already been merged into a single compile-tested application. The final master package will only be labelled final after merge, dependency resolution, analyzer/type-check/build, and test verification.
