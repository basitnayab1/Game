
# N5 Game — Part 12 Agent Dashboard

Included:
- Agent Dashboard
- Home
- Promotion Sharing
- My Data
- Commission
- Subordinates
- Agent status / application placeholder
- Direct referral and network metrics
- Backend/Admin-configurable commission structure

Production notes:
- Agent approval must be backend-authoritative.
- Commission rates, eligibility, settlement and limits must be configured server-side.
- Do not calculate or credit commissions solely in the client app.
- Agent/referral relationships must have audit records and anti-fraud checks.
- Production sharing/QR uses the backend-generated agent URL/code.
