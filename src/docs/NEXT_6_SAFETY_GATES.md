# N5 Next 6 — API, Idempotency & Webhook Safety

## 133 — Safe API retry policy
Only explicitly marked read-style requests (GET/HEAD/OPTIONS) may be replayed after an access-token refresh. Financial or other mutation requests are never automatically replayed by the player client.

## 134 — Idempotency persistence contract
Idempotency keys must be unique within the correct user/operation scope and enforced by the database in the same transaction as the mutation. Completed responses may be replayed; the client never becomes the financial authority.

## 135 — Webhook signature guard
Webhook handlers require provider/event/signature metadata and provide constant-time HMAC-SHA256 verification. Production handlers must preserve the raw request body, verify the provider secret, enforce event-id uniqueness, validate the payload, and only then perform an authorized state transition.

These are source-level safety gates. They do not create or bypass real payment/game provider access, licensing, or credentials.
