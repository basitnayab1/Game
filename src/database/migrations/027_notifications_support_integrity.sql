-- N5 Notifications + Support integrity
ALTER TABLE notifications
  ADD CONSTRAINT notifications_category_chk CHECK (category IN ('TRANSACTION','PROMOTION','SECURITY','SYSTEM'));
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, read_at, created_at DESC);

ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_status_chk CHECK (status IN ('open','in_progress','waiting_for_user','resolved','closed','reopened'));
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_updated
  ON support_tickets(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket_created
  ON support_messages(ticket_id, created_at ASC);
