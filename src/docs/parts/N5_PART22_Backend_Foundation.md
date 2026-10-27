# N5 Game — Part 22 Backend Foundation

## Status
Foundation only. This is not the complete production backend and does not connect to live money, payment, game, KYC, or gambling-provider systems.

## Included
- Node.js + TypeScript + Express foundation
- Environment validation with Zod
- Helmet security headers
- CORS configuration
- JSON request handling
- Request IDs
- Central error handling
- Versioned `/api/v1` route structure
- Health endpoint
- Test/build/typecheck scripts
- Initial migration marker

## Planned backend domains
Auth, users/profile, wallet/ledger, transactions, deposits, withdrawals, games/provider adapters, promotions/rewards, VIP, referral, agent, KYC, security/risk/audit, notifications, support, responsible gaming, configuration, webhooks and idempotency.

## Important production boundary
Live real-money operation requires the operator's lawful licensing/authorization, contracts, provider credentials, payment/KYC arrangements, jurisdiction controls and production secrets. Those external dependencies are not fabricated or bypassed by this project.

## Commands
```bash
npm install
npm run typecheck
npm test
npm run build
npm run dev
```
