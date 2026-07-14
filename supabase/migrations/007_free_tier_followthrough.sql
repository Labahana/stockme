-- Free-tier follow-through: archives bucket, vacuum helper, completed stocktake purge

-- Private storage bucket for gzip PO archives (1 GB free, separate from DB)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('archives', 'archives', false, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Service role can manage archive objects; no public policies (admin SDK only)
DROP POLICY IF EXISTS "Service role archives all" ON storage.objects;
-- Rely on service role key bypassing RLS for uploads from the API.

-- Note: VACUUM cannot run inside a plpgsql function (needs own transaction).
-- ANALYZE keeps planner stats fresh; run VACUUM from Dashboard when purging heavily.
CREATE OR REPLACE FUNCTION run_maintenance_analyze()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  ANALYZE webhook_logs;
  ANALYZE sync_runs;
  ANALYZE purchase_orders;
  ANALYZE po_line_items;
  ANALYZE inventory_levels;
END;
$$;

CREATE OR REPLACE FUNCTION purge_old_completed_stocktakes(days_old INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM stocktakes
  WHERE status = 'completed'
    AND completed_at IS NOT NULL
    AND completed_at < NOW() - make_interval(days => days_old);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Safe shrinks only where existing values are short enough (no rewrite / data loss)
DO $$
BEGIN
  -- sku / barcode commonly short
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'variants' AND column_name = 'sku' AND data_type = 'text'
  ) THEN
    -- Only alter if no oversized values
    IF NOT EXISTS (SELECT 1 FROM variants WHERE sku IS NOT NULL AND char_length(sku) > 80) THEN
      ALTER TABLE variants ALTER COLUMN sku TYPE VARCHAR(80);
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'variants' AND column_name = 'barcode' AND data_type = 'text'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM variants WHERE barcode IS NOT NULL AND char_length(barcode) > 64) THEN
      ALTER TABLE variants ALTER COLUMN barcode TYPE VARCHAR(64);
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stores' AND column_name = 'email' AND data_type = 'text'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM stores WHERE email IS NOT NULL AND char_length(email) > 255) THEN
      ALTER TABLE stores ALTER COLUMN email TYPE VARCHAR(255);
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'suppliers' AND column_name = 'email' AND data_type = 'text'
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM suppliers WHERE email IS NOT NULL AND char_length(email) > 255) THEN
      ALTER TABLE suppliers ALTER COLUMN email TYPE VARCHAR(255);
    END IF;
  END IF;
END $$;

-- Free DB space from image URLs we don't need for inventory ops (Shopify CDN can refetch)
-- Keep column but clear empty/null noise via noop; optional NULLing of unused urls deferred.
