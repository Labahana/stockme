-- Free-tier optimization: metadata webhook logs, sync cursors, purge helpers

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  topic VARCHAR(80) NOT NULL,
  webhook_id VARCHAR(80) NOT NULL,
  status SMALLINT NOT NULL DEFAULT 1, -- 1=received 2=processed 3=error
  processed_at TIMESTAMPTZ,
  error_message VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, webhook_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_shop_created
  ON webhook_logs (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed
  ON webhook_logs (processed_at);

ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS sync_state (
  shop_id UUID PRIMARY KEY REFERENCES stores (id) ON DELETE CASCADE,
  phase TEXT NOT NULL DEFAULT 'idle'
    CHECK (phase IN ('idle', 'locations', 'products', 'bundles', 'completed', 'error')),
  product_cursor TEXT,
  products_synced INTEGER NOT NULL DEFAULT 0,
  variants_synced INTEGER NOT NULL DEFAULT 0,
  inventory_synced INTEGER NOT NULL DEFAULT 0,
  locations_synced INTEGER NOT NULL DEFAULT 0,
  error_message VARCHAR(500),
  started_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sync_state ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION purge_old_webhook_logs(days_old INTEGER DEFAULT 7)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM webhook_logs
  WHERE created_at < NOW() - make_interval(days => days_old);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION purge_old_sync_runs(days_old INTEGER DEFAULT 14)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM sync_runs
  WHERE started_at < NOW() - make_interval(days => days_old)
    AND status IN ('completed', 'failed');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
