# Account Statement Consistency

- Wallet/statement is read-only and authenticated.
- All money values use PKR minor units.
- Date ranges are inclusive at the calendar-day level.
- Deposit and bonus totals include only confirmed transactions.
- Play total is an aggregate activity amount; round-level history is not exposed.
- Withdrawal summary includes completed withdrawals only; reversal handling remains in reconciliation.
- Withdrawal history can show completed/reversed records with method, fee, net amount and status.
- The Player UI must not ship fabricated statement data.
