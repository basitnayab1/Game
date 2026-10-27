# N5 Game — Part 17: Responsible Gaming

## Included
- 18+ responsible-use information
- Session reminder toggle
- Deposit limit entry
- Loss limit entry
- Take-a-break flow
- Self-exclusion entry
- Location and eligibility information
- Support entry
- Backend-authoritative implementation notes

## Production requirements
Responsible-gaming controls must be enforced by the backend, not only by Flutter UI.

Production configuration must follow the applicable jurisdiction, licence, regulator, payment provider and game-provider requirements.

Do not hardcode legal claims or assume a control is available in every jurisdiction.

Account restrictions must be auditable and must not be bypassed by reinstalling the app, changing devices, or manipulating client-side data.

## Status
Player-facing UI: complete for this part.
Production enforcement/integrations: backend and lawful operator/provider configuration required.
