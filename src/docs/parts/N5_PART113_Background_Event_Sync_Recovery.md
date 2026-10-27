# N5 Part 113 — Background Event Sync & Recovery

Foundation for reliable resynchronization after app restart, backgrounding, network recovery, or missed notifications.

## Scope
- Server-authoritative refresh after app resume/reconnect.
- Safe synchronization of wallet/transactions, notifications, KYC/security state, rewards, and game availability.
- Do not treat push notifications as the source of truth.
- No automatic financial mutation from the client.
- Stale/duplicate events must be harmless.
- Financial status is refreshed from the backend before being shown as final.

## Production rule
Push/background delivery providers are external dependencies. The player app must recover correctly even if a push notification is delayed, duplicated, or never delivered.
