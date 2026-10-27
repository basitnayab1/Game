# N5 Next 31 — Admin Games & Providers

Adds an authenticated-admin management boundary for the existing game/provider catalog.

## Admin capabilities
- List providers and game counts.
- List/search/filter games.
- Toggle provider active/inactive, internal authorization flag, and featured flag.
- Toggle game active/inactive, HOT/NEW/featured flags, and display order.
- Every mutation writes an audit event with the acting admin.

## Boundary
The internal `is_authorized` flag does not create a license, contract, provider credential, or legal authorization. Production launch still requires an authorized provider adapter and operator-side contracts/credentials. No wallet or ledger mutation is exposed by these routes.
