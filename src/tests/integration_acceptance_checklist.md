# N5 Part 107 — Integration Acceptance Checklist

Before the master ZIP is called final:

1. Flutter dependency resolution succeeds.
2. `flutter analyze` has no blocking errors.
3. Flutter build succeeds for the intended release target.
4. Backend TypeScript type-check/build succeeds.
5. Database migrations apply in order.
6. Auth/session tests pass.
7. Wallet/ledger integrity tests pass.
8. Deposit/withdrawal idempotency and state tests pass.
9. Provider webhook verification tests pass.
10. KYC/security authorization tests pass.
11. Localization and RTL smoke tests pass.
12. Responsible gaming/account-closure tests pass.
13. No production secrets are present.
14. Duplicate/conflicting implementations are removed or explicitly archived.
