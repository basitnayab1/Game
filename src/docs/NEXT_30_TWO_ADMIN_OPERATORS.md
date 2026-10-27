# N5 Next 30 — Two Admin Operators + Operations Management

## Locked requirement
N5 has exactly two authorized admin operator accounts. The database permits at most two active admin users. Each operator uses their own account; shared credentials are not the intended model.

Both operators have broad operational visibility across users, KYC, risk, support, configuration and app health. Actions are attributed to the authenticated operator in `audit_events`.

## Safety boundary
Admin tools do not provide direct wallet/ledger balance editing, game-outcome manipulation, fake KYC, payment-provider bypasses, or licensing bypasses. Financial/provider production actions remain separately authorized and auditable.

## Provisioning
After the two operator users exist in the production identity system, an authorized deployment operator inserts those two user IDs into `admin_users` with the desired role (`admin` or `super_admin`). The migration enforces a maximum of two active admin operators.
