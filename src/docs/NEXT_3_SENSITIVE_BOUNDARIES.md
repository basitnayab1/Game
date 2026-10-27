# Sensitive Player Boundaries

This gate hardens three areas:

1. **KYC/security:** client requests are scoped to the authenticated user and cannot set KYC verification status or provider results.
2. **Responsible gaming:** only explicitly supported control fields may be updated; invalid reminder values and unknown fields are rejected.
3. **Account closure:** a recent security verification and zero pending obligations are required before creating/cancelling a closure request.

Production adapters must enforce these rules inside the authoritative API/database transaction layer. The player app never decides KYC approval, closure completion, financial settlement, or self-exclusion enforcement locally.
