-- Admin VIP management: configuration only; never directly credits wallet/ledger.
-- VIP20 daily salary is preserved at 333.00 (33300 minor units).
ALTER TABLE vip_levels ADD CONSTRAINT vip_daily_salary_nonnegative CHECK (daily_salary_minor IS NULL OR daily_salary_minor >= 0);
ALTER TABLE vip_levels ADD CONSTRAINT vip_monthly_salary_nonnegative CHECK (monthly_salary_minor IS NULL OR monthly_salary_minor >= 0);
ALTER TABLE vip_levels ADD CONSTRAINT vip_next_bonus_nonnegative CHECK (next_level_bonus_minor IS NULL OR next_level_bonus_minor >= 0);
ALTER TABLE vip_levels ADD CONSTRAINT vip_progress_target_nonnegative CHECK (progress_target_minor IS NULL OR progress_target_minor >= 0);
UPDATE vip_levels SET daily_salary_minor=33300 WHERE level=20;
