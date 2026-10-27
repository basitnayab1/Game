# N5 Game — Part 21: Player App Integration Foundation

## Purpose
This part establishes the shared routing and feature-configuration foundation
needed to connect the previously built player-facing modules into one app.

## Included
- Central route constants
- Bottom-navigation section mapping
- Feature flags
- Integration notes

## Integration order
1. Consolidate all player feature files under `player_app/lib`.
2. Replace duplicate/mock routes with the central `AppRoutes`.
3. Connect the existing GoRouter configuration.
4. Connect Profile/Settings links to their actual destinations.
5. Connect Home bottom navigation.
6. Connect Wallet -> Deposit/Withdrawal/Statement.
7. Connect Games -> Search/Favorites/Recent/Provider.
8. Connect Promotions/Rewards/VIP/Referral.
9. Connect KYC/Security/Support/FAQ.
10. Connect Responsible Gaming/Account Closure/Language.
11. Remove temporary placeholder screens and duplicate route definitions.
12. Run analyzer, unit/widget tests and integration smoke tests.

## Important
This is an integration foundation, not a claim that all previous ZIPs have
already been merged into one compile-tested application.

Production financial, provider, KYC and account-security behavior remains
backend-authoritative.
