# N5 Game — External Services & Production Boundary

The source package intentionally does not contain production credentials.

External operator/provider configuration may include:
- payment provider(s)
- authorized game provider(s)
- KYC/identity provider
- OTP/SMS provider
- push notifications
- object storage
- hosting/cloud infrastructure
- domain/DNS/TLS

The source provides contracts and integration boundaries where applicable. Actual provider credentials, contracts, licensing and jurisdiction/platform approvals remain external requirements.

Customer funds and platform revenue must remain separate in the accounting/ledger design. Production real-money functionality must only be activated where the operator has the required lawful authorization and provider arrangements.
