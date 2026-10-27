# N5 Next 142–144 — Migration, Recovery & Production Configuration Safety

## 142 — Migration integrity
- Migrations are numbered sequentially and must be applied in order.
- Production/staging deployment must use a migration runner that records applied versions.
- Never edit an already-applied production migration; create a new migration for changes.
- Before migration 019, check existing ledger data for duplicate non-null idempotency keys.

## 143 — Backup and recovery
- Backups must be encrypted and access-controlled.
- Keep backups separate from the primary database host/account where practical.
- Test restore procedures on a schedule; a backup that has never been restored is not considered verified.
- Financial recovery uses ledger/reconciliation records; never manufacture a wallet balance from a backup of the mobile app.
- Recovery of an unknown transaction outcome must be server-side and auditable.

## 144 — Environment/configuration safety
- `development`, `test`, `staging`, and `production` are distinct environments.
- Staging and production require database/JWT configuration.
- Production must not use wildcard CORS or non-versioned API prefixes.
- Real provider/payment/KYC credentials remain external secrets and are never committed.
- `.env.example` contains placeholders only.
