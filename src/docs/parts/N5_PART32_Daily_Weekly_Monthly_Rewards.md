# Part 32 — Daily / Weekly / Monthly Reward Cycles

Implements the data foundation for N5's reward-cycle rules:
- user manually claims/open rewards
- unclaimed rewards can expire according to configuration
- each cycle is unique
- next cycle is a new record
- server is authoritative

Actual reward values remain configurable and must follow applicable lawful/provider rules.
