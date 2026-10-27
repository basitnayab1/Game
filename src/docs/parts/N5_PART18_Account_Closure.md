# N5 Game — Part 18: Account Closure

## Included
- Account closure screen
- Closure confirmation
- Security verification state
- Pending obligations state
- Processing state
- Closed state
- Pending balance/transaction notice
- Open support-case notice
- Required-record retention notice
- Backend-authoritative production notes

## Closure state flow
Request
→ Pending Security Verification
→ Pending Obligations
→ Processing
→ Closed

A production backend may add additional states such as:
- Rejected
- More Information Required
- Compliance Review
- Reopened/Cancelled where legally and operationally permitted

## Production requirements
- Closure requests must be authenticated and server-authoritative.
- Sensitive actions should require appropriate re-authentication/OTP where required.
- The client must not directly delete wallet, ledger, KYC, transaction or audit records.
- Required records must be retained only for applicable legal, regulatory, financial, fraud/security and contractual periods.
- Personal data deletion/anonymization should follow the applicable privacy and retention policy.
- Any outstanding financial obligations must be handled through the lawful operator/payment process.
- Closure must not be used to bypass KYC, AML, fraud, dispute or regulatory obligations.

## Status
Player-facing UI: complete for this part.
Production enforcement and retention policy: backend/operator/legal configuration required.
