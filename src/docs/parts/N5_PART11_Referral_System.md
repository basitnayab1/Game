
# N5 Game — Part 11 Referral System

Included:
- Referral dashboard
- Referral code
- Copy/share placeholders
- QR display placeholder
- Total/Pending/Qualified/Rewarded counters
- Referral History
- Empty state
- Backend/Admin configuration note

Production integration:
- Referral code/link must come from the backend.
- Qualification and reward eligibility must be backend-authoritative.
- Anti-fraud/duplicate-account checks must run server-side.
- Reward amount and eligibility must be configurable from Admin Panel.
- Do not credit rewards from the client app.
- Production sharing/QR should use approved Flutter packages and the final backend referral URL.


Router integration:
Add ReferralScreen to the existing router and connect the Profile/Invite bottom-navigation destination to it.
Do not create a second referral route if one already exists; merge this feature into the existing routing structure.
