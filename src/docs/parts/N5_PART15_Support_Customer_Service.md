
# N5 Game — Part 15 Support / Customer Service

Included:
- Support category selection:
  Deposit
  Withdrawal
  Account
  KYC
  Game
  Promotion
  Security
  Other
- Create Support Ticket
- My Tickets
- Ticket conversation entry point
- Live Support entry point
- Empty states
- Backend-authoritative support architecture

Recommended production ticket states:
- Open
- In Progress
- Waiting for User
- Resolved
- Closed
- Reopened

Production requirements:
- Ticket IDs generated server-side.
- User/account information should be pulled from authenticated session.
- Sensitive financial/KYC information must be access-controlled.
- Support agents should have role-based permissions.
- Every support status/message change should be auditable.
- Attachments, if enabled, require secure storage and access controls.
- Live support is optional and depends on an approved support provider/system.
