# N5 Part 117 — Transaction Recovery & Reconciliation Guard

Purpose: safely classify interrupted database transactions and prevent the player app from guessing a financial outcome.

Rules:
- Deadlock/serialization failures may be retried by the server using bounded, safe retry logic.
- Constraint/explicit rollback failures remain rolled back.
- Unknown outcomes require server-side reconciliation before the financial state is considered final.
- The mobile client must never infer or manufacture a successful deposit, withdrawal, wallet credit, or debit.
- Final production implementation must run inside the canonical database transaction layer and be covered by integration tests against PostgreSQL.
