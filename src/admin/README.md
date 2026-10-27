# N5 Game Admin Foundation

This is the initial React/Vite admin foundation. It currently exposes the controlled configuration surface only.

## Security boundary
- Requires authenticated admin/super_admin role through the backend.
- Configuration keys are allow-listed server-side.
- Secrets cannot be stored in the admin configuration table.
- Wallet balances, ledger entries, game outcomes, provider credentials and customer funds are not editable through this surface.
- Production deployment must connect the backend to PostgreSQL and the real authentication/session system.

## Run later
Install dependencies, set `VITE_API_BASE_URL`, then run the standard Vite dev/build commands.

## Two-operator model
N5 Admin is designed for two separate authorized operator accounts. The database enforces a maximum of two active admin users. Both may have broad operational visibility. Do not share credentials. Each action is attributed to its authenticated operator in the audit log.
