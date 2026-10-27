# N5 Part 48 — Reward Scheduler Foundation

Foundation for daily/weekly/monthly reward-cycle jobs. The scheduler creates/updates server-side cycle records and expiry state; it never credits a wallet directly from a client request. Actual reward eligibility and financial posting must run through the authoritative reward/ledger services.
