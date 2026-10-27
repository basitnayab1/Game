# N5 Part 39 — Account Closure Backend

Server-side closure request lifecycle: requested → security review → pending obligations → processing → closed.

Closure must not erase records that must legally/provider-wise be retained, and it must not bypass pending financial/KYC/audit obligations. User-facing deletion language should be jurisdiction-specific.

Production implementation should use a transaction/state machine and audit every status transition.
