# N5 Game — Part 10: VIP System

## Final VIP levels
1. Bronze I
2. Bronze II
3. Bronze III
4. Silver I
5. Silver II
6. Silver III
7. Gold I
8. Gold II
9. Gold III
10. Gold IV
11. Platinum I
12. Platinum II
13. Platinum III
14. Platinum IV
15. Diamond I
16. Diamond II
17. Diamond III
18. Diamond IV
19. Black
20. Royal

## Included
- VIP Center
- Current VIP level
- Progress bar
- Next level
- All 20 levels
- Level detail
- Benefits
- Level reward field
- Criteria/eligibility section
- Reward history
- Server-authoritative progression

## Important clarification
The 20-level names are fixed in this part.

The exact monetary reward/threshold for each level was NOT permanently encoded here because the earlier project specification did not contain a complete verified table of exact amounts for all 20 levels. Rather than inventing numbers and accidentally changing the user's intended system, each level has a configurable reward field.

When the final exact 20-level reward table is approved, it can be entered into the backend configuration without redesigning the app.

VIP progression should be configurable and must comply with the final lawful/licensed operating model, provider terms and responsible-use requirements.

## Production rule
VIP level, progress, eligibility and rewards are backend authoritative. The mobile client cannot promote itself, change progress or create rewards.
