# N5 Part 46 — Idempotency Store Foundation

Reusable contract for financial and reward operations. Production persistence must use a database uniqueness constraint/transaction so duplicate requests cannot create duplicate credits, debits, withdrawals, claims, or provider callbacks.
