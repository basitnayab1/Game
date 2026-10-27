# N5 Game — Part 23: Authentication & User Account Foundation

## Included
- Registration with phone, DOB and password validation
- OTP request/verification foundation
- Password hashing with bcrypt
- Short-lived access tokens and rotating refresh sessions
- Session revocation / logout
- Auth middleware
- Authenticated `/api/v1/users/me`
- Environment validation and production-secret placeholders
- Basic account status handling

## Important production boundary
This is a development foundation, not a production gambling/payment system. OTP delivery, database persistence, KYC, rate limiting, device risk, audit logs, password recovery, and provider integrations must be completed and configured for the lawful production environment.

Development OTP is returned only outside production to make local testing possible. Never expose OTPs in production.

## Run
1. Copy `.env.example` to `.env` and use long random secrets.
2. `npm install`
3. `npm run build`
4. `npm start`

## API foundation
- POST `/api/v1/auth/register`
- POST `/api/v1/auth/otp/request`
- POST `/api/v1/auth/otp/verify`
- POST `/api/v1/auth/login`
- POST `/api/v1/auth/refresh`
- POST `/api/v1/auth/logout`
- GET `/api/v1/users/me`
