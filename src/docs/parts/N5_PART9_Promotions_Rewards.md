# N5 Game — Part 9: Promotions + Rewards

## Included
- Promotions list
- Promotion detail
- Welcome Promotion
- Deposit Promotions
- Daily Rewards
- VIP Rewards entry
- Referral Rewards entry
- Limited-Time campaigns
- 7-day daily reward calendar
- Weekly Bonus
- Monthly Bonus
- Manual OPEN / CLAIM flow
- Reward History

## Reward rules implemented at UI level
- User manually opens/claims an available reward.
- Closing a reward popup does not intentionally discard an available reward.
- Weekly and monthly rewards are separate cycles.
- Unclaimed rewards expire according to the configured expiry period.
- A new cycle creates new eligibility.
- Backend remains authoritative for eligibility, amount, expiry and duplicate prevention.

## Production rule
Reward balances/claims must never be created solely by the mobile client. Production APIs should use authentication, idempotency, server-side eligibility, audit logs and transaction/ledger controls.

Current reward amounts are mock/demo values and are not production promises.
