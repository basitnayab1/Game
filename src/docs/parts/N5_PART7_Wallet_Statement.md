# N5 Game — Part 7: Wallet + Account Statement

## Included
- Wallet screen
- Available balance
- Bonus/promotional balance display
- Pending/locked display
- Deposit/Withdraw entry points
- Recent activity
- Account Statement
- From Date / To Date filter
- Total Deposit
- Total Play
- Total Withdrawal
- Total Platform Withdrawal Fee
- Total Bonus Received
- Separate Deposit History
- Separate Withdrawal History
- Transaction status display

## Important
This part uses mock UI data only.

Production financial values must come from the backend-authoritative ledger. The mobile app must never directly edit balances or create/confirm financial transactions.

The Account Statement intentionally does NOT show round-by-round game history. Total Play is an aggregated backend activity value for the selected date range.

## Status model
The final transaction system should support:
Pending, Confirmed, Failed, Cancelled, Reversed, Locked.

Withdrawal may additionally show:
Under Review, Approved, Processing, Completed, Rejected.

## Next
Part 8 — Deposit + Withdrawal UI and lawful/authorized payment-provider interface.
