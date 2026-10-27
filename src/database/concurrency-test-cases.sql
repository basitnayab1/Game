-- N5 PART 116: PostgreSQL concurrency test cases.
-- Run only against an isolated test database.
-- These are test scenarios; they do not modify production configuration.

-- Case 1: two withdrawals against the same wallet must serialize.
-- Session A: BEGIN; SELECT * FROM wallet_accounts WHERE user_id = '<TEST_USER>' FOR UPDATE;
-- Session B: BEGIN; SELECT * FROM wallet_accounts WHERE user_id = '<TEST_USER>' FOR UPDATE;
-- Assert: Session B waits until Session A commits/rolls back; final ledger remains valid.

-- Case 2: same idempotency key must not create two financial effects.
-- INSERT INTO ledger_entries (..., idempotency_key) VALUES (..., '<SAME_KEY>');
-- Repeat with the same key from a second transaction.
-- Assert: unique constraint rejects the duplicate and no second financial effect exists.

-- Case 3: interrupted transaction must roll back atomically.
-- BEGIN; create transaction + ledger mutation; ROLLBACK;
-- Assert: neither partial record nor partial balance effect remains.
