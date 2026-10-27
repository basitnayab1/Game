# N5 Game — Part 8: Deposit + Withdrawal

## Included
### Deposit
- Amount input
- Quick amounts: 100 / 500 / 1,000 / 5,000 / 10,000
- Minimum PKR 100
- Maximum PKR 50,000 per transaction
- Payment-method selection
- Payment confirmation
- Deposit status

### Withdrawal
- Amount input
- Quick amounts
- Easypaisa / JazzCash / Bank method selection
- Per-transaction limits
- Platform Withdrawal Fee display
- Net amount calculation
- Withdrawal confirmation
- Withdrawal status

## Important production rule
These screens are UI/demo flows. They do NOT move real money.

Production architecture must be:
User → Backend → Authorized Payment Provider → Provider Verification/Webhook → Backend Ledger → Wallet.

A screenshot or client-side success response must never credit a wallet.

Withdrawal production checks should include:
- authenticated session
- sufficient available balance
- KYC/eligibility
- verified payment-account ownership
- limits
- risk/fraud checks
- duplicate/idempotency protection
- backend ledger reservation
- provider processing
- webhook/status reconciliation
- audit trail

## Fee note
The current UI demonstrates the previously discussed fee examples:
10k = 400
20k = 900
30k = 1,500
40k = 2,200
50k = 3,000

Amounts above 50k use an illustrative extension for the bank UI only. Final fee rules must be configurable and legally/provider reviewed.

## External requirements
Actual provider credentials, contracts, settlement arrangements, licenses/approvals and production merchant configuration are external operator/provider requirements. They must not be hard-coded into the app.
