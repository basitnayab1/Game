# N5 Next Finalization — Auth Session Reliability

## Fixed
- Player authentication responses are now validated more strictly.
- Refresh-token flow is represented in the player auth repository.
- The API client can persist refreshed access/refresh tokens and retry one failed authenticated request after a 401.
- Refresh requests are excluded from recursive refresh handling.
- Refresh failure clears local tokens so a stale session is not retained.
- Duplicate wallet imports were removed.
- Player-facing wording that explicitly said "mock" was replaced with neutral request wording; production authority remains server-side.

## Important boundary
The real OTP/SMS provider, production API URL, authorized payment/game/KYC providers, credentials, contracts, and lawful production configuration remain external dependencies. They are not hard-coded into source.
