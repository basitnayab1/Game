# N5 Part 108 — Master Merge Execution Plan

This part starts the actual consolidation phase. It defines the order for merging the existing interim player-app and backend foundations into one canonical project.

## Rules
- Preserve the canonical architecture from Parts 103–107.
- Final player languages: English (en), Turkish (tr), Hindi (hi), Urdu (ur), Arabic (ar).
- One router, one API client, one secure storage implementation, one canonical feature implementation.
- Server remains authoritative for wallet, payments, rewards, KYC, security, provider state and account status.
- Do not include production provider credentials or secrets.

## Merge order
1. Foundation/theme/config
2. Routing/navigation
3. Localization
4. Authentication/session
5. Wallet/ledger/transactions
6. Deposits/withdrawals/payments
7. Games/provider contracts
8. Promotions/rewards/VIP/referral/agent
9. KYC/security
10. Notifications/support/FAQ
11. Settings/responsible gaming/account closure
12. Tests, analyzer/type-check/build, cleanup

This is an execution manifest, not a claim that the full application has already been merged or compiled.
