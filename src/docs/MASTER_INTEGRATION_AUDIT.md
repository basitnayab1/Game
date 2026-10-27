# N5 Game — Master Integration Audit (Part 101)

## Purpose
This phase moves the project from sequential feature foundations toward one consolidated developer project.

## Verified local batch
The currently mounted `n5_next_parts` directory contains the later integration artifacts (Parts 77–100). Earlier parts are retained in the project/library history and must be brought into the same workspace before the final merge.

## Merge rules
1. One canonical route registry.
2. One canonical API client.
3. One authentication/session authority.
4. One wallet/ledger authority; client never edits balances.
5. One localization configuration with the final five languages:
   - English (en)
   - Turkish (tr)
   - Hindi (hi)
   - Urdu (ur)
   - Arabic (ar)
6. Provider credentials/secrets stay outside source control.
7. Payment/game/KYC callbacks are verified and idempotent.
8. Duplicate contracts are consolidated rather than copied.
9. Mock/demo data must be clearly separated from production adapters.
10. Final build is not declared production-ready until analyzer/type-check/build/tests pass after merge.

## Financial safety checks
- Deposit is pending until authorized provider verification.
- Withdrawal fee/status/net amount are server generated.
- No screenshot-based wallet credit.
- No client-side balance mutation.
- Historical ledger entries are append-only; corrections use auditable compensating entries.

## External dependencies
Production activation still requires lawful/licensed operation where applicable, authorized game/payment/KYC providers, merchant/provider contracts, credentials, infrastructure, and jurisdiction-specific compliance review.

## Final gate
After all historical parts are physically consolidated into one workspace:
- resolve duplicate files/imports/routes
- run Flutter analyze/build/tests
- run backend type-check/build/tests
- run database migration checks
- run security/release gates
- package only the verified merged project as `N5_GAME_FINAL_SOURCE_CODE.zip`
