
# N5 Game — Part 14 Security & Devices

Included:
- Security status
- Change Password
- OTP / verification security
- Active Devices
- Login History
- Logout Other Devices
- Security Alerts

Production requirements:
- Authentication/session authority must remain server-side.
- Use short-lived access tokens and secure refresh-token handling.
- Store sensitive tokens using platform-secure storage.
- Revoke sessions server-side.
- Rate-limit login, OTP, password-reset and sensitive actions.
- Record security events and audit events.
- Detect unusual/new-device activity according to the approved risk policy.
- Never expose passwords, OTPs or secrets in logs.
- Provider/API secrets must remain server-side.
