
# N5 Game — Part 13 KYC / Identity Verification

Included:
- KYC status flow:
  Not Started
  In Progress
  Verified
  Rejected
  Additional Information Required
- Personal information
- Identity document upload placeholders
- Selfie/liveness placeholder where required
- Payment ownership verification section
- Submit for verification
- Backend-authoritative verification architecture

Production requirements:
- Use an approved/licensed identity/KYC provider where required.
- Never trust client-side KYC status.
- Store sensitive documents securely with restricted access and encryption.
- Do not place identity documents in ordinary public object-storage URLs.
- Maintain audit records for KYC status changes.
- Apply applicable retention/deletion requirements.
- Do not bypass age, identity, geographic or regulatory checks.
- Provider credentials and production configuration are external dependencies.
