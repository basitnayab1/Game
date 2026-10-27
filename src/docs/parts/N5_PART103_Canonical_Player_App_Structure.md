# N5 Game — Part 103: Canonical Player App Structure

This part defines the canonical Flutter player-app folder/module map for the master merge.

## Canonical structure
- `lib/core/` — theme, routing, networking, storage, config, localization, security
- `lib/features/` — feature-owned presentation, data/repository, models/contracts
- `lib/shared/widgets/` — reusable UI components only
- `test/` — unit/widget/integration tests

## Feature modules
splash, onboarding, auth, home, wallet, games, rewards, vip, referral, agent, kyc, security, notifications, support, faq, localization, responsible_gaming, account_closure, profile, settings.

## Merge rules
1. One canonical route registry.
2. One API client/network boundary.
3. One auth/session authority.
4. One server-authoritative wallet/financial boundary.
5. No production secrets in the Flutter project.
6. Mock/demo data must remain isolated from production adapters.
7. Duplicate legacy files are removed only after their functionality is mapped to the canonical module.
8. Final merge must pass Flutter analyze, build, unit/widget tests, and integration smoke tests.

This is an internal merge artifact, not the final developer handover.
