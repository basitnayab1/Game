# N5 Game — Part 19: Notifications & System Messaging

## Included
- All notifications
- Transaction notifications
- Promotion notifications
- Security notifications
- System notifications
- Unread/read state
- Read-all action
- Notification detail bottom sheet
- Category filtering
- Empty state
- Backend-authoritative production notes

## Production architecture
Notifications should be generated and stored by the backend.

Recommended notification fields:
- notification_id
- user_id
- type
- title
- message/body
- metadata/action target
- created_at
- read_at
- expires_at (optional)
- locale
- delivery status
- source/event ID
- audit information

## Delivery
The system can support:
- In-app notifications
- Push notifications
- Email/SMS where legally and operationally appropriate

Sensitive information should not be exposed in push-preview text. Financial/security notifications should use verified backend events.

## Important
Promotion and financial messaging must be based on server-side eligibility and actual transaction/provider states. The client must not create or alter notification records.

Production push credentials, notification provider configuration and templates are external deployment/operator configuration.
