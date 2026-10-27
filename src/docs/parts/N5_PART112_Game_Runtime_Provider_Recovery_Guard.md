# N5 Part 112 — Game Runtime & Provider Recovery Guard

Purpose: make game launching and runtime recovery predictable when network or an authorized provider is unavailable.

Rules:
- A game launch is not considered successful until the backend/provider returns a valid launch session.
- Expired or invalid launch sessions are rejected and a fresh authorized launch may be requested.
- Retry is allowed only for explicitly retryable failures; financial actions are never retried by this game-runtime layer.
- Provider downtime is surfaced as an unavailable state, not a fake successful launch.
- Eligibility, region, age, KYC and provider authorization remain server/provider controlled.
- The player app never determines game outcomes or credits a wallet from a game UI response.
- Production provider credentials and contracts remain external configuration.
