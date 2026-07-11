ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS low_stock_digest_enabled BOOLEAN NOT NULL DEFAULT false;
