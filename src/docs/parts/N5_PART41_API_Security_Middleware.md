# N5 Part 41 — API Security Middleware

Adds reusable request-ID, authentication/authorization and idempotency foundations.

Production notes:
- Real token verification must use the established auth/session service.
- Financial mutations must persist idempotency state transactionally.
- Never accept user ID, role or balance authority from the mobile client.
