-- 034_admin_payment_methods.sql
-- Canonical schema for operator-configured payment channels and cashier options.
-- Admin operators manage payment channels (Easypaisa, JazzCash, Binance Pay, UPI, etc.)
-- Players query active payment methods for cashier deposits.

CREATE TABLE IF NOT EXISTS admin_payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code VARCHAR(10) NOT NULL DEFAULT 'ALL',
    category VARCHAR(30) NOT NULL DEFAULT 'wallet',
    name VARCHAR(100) NOT NULL,
    account_title VARCHAR(150),
    account_number TEXT NOT NULL,
    instructions TEXT,
    min_deposit NUMERIC(12,2) DEFAULT 100,
    max_deposit NUMERIC(12,2) DEFAULT 500000,
    active BOOLEAN DEFAULT TRUE,
    badge_text VARCHAR(50) DEFAULT '',
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_payment_methods_active_country 
ON admin_payment_methods(active, country_code);

CREATE INDEX IF NOT EXISTS idx_admin_payment_methods_display_order 
ON admin_payment_methods(display_order);
