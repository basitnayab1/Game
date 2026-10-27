# N5 Part 115 — Admin Foundation + Controlled Configuration

## Added
- PostgreSQL migration 029 for admin roles, admin users and versioned configuration.
- Admin configuration service/repository/controller.
- Authenticated `GET /api/v1/admin/config` and `PATCH /api/v1/admin/config` routes with `admin` / `super_admin` role boundary.
- Safe allow-list for non-secret operational settings.
- React/Vite admin foundation with configuration view and server-side validation.
- Contract tests for the admin security boundary.

## Deliberate exclusions
- No direct wallet balance editing.
- No ledger deletion/editing.
- No game outcome manipulation.
- No provider secret storage in the configuration table.
- No production payment/provider credentials in source.
- No bypass of licensing, KYC, age, geo or responsible-gaming controls.

## Production wiring still required
- Real authentication/session middleware must populate the authenticated user and roles.
- PostgreSQL connection/repository must be injected into `app.locals.adminConfigService`.
- Admin users must be provisioned through the operator's authorized access process.
- Admin mutation audit persistence must be connected to the existing audit-events repository/service.
