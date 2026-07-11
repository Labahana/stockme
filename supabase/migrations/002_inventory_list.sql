-- Paginated inventory list with stock-status filtering (Day 3-4)

CREATE OR REPLACE FUNCTION inventory_list(
  p_shop_id UUID,
  p_location_id UUID,
  p_search TEXT DEFAULT NULL,
  p_stock_status TEXT DEFAULT 'all',
  p_tag TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  variant_id UUID,
  product_id UUID,
  product_title TEXT,
  variant_title TEXT,
  sku TEXT,
  barcode TEXT,
  vendor TEXT,
  tags TEXT[],
  image_url TEXT,
  available INT,
  min_stock INT,
  max_stock INT,
  total_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH base AS (
    SELECT
      v.id AS variant_id,
      p.id AS product_id,
      p.title AS product_title,
      v.title AS variant_title,
      v.sku,
      v.barcode,
      p.vendor,
      p.tags,
      p.image_url,
      COALESCE(il.available, 0) AS available,
      COALESCE(vls.min_stock, 0) AS min_stock,
      vls.max_stock
    FROM variants v
    INNER JOIN products p ON p.id = v.product_id
    LEFT JOIN inventory_levels il
      ON il.variant_id = v.id AND il.location_id = p_location_id
    LEFT JOIN variant_location_settings vls
      ON vls.variant_id = v.id AND vls.location_id = p_location_id
    WHERE v.shop_id = p_shop_id
      AND p.status = 'active'
      AND (
        p_search IS NULL
        OR p_search = ''
        OR v.sku ILIKE '%' || p_search || '%'
        OR v.barcode ILIKE '%' || p_search || '%'
        OR p.title ILIKE '%' || p_search || '%'
        OR v.title ILIKE '%' || p_search || '%'
      )
      AND (
        p_tag IS NULL
        OR p_tag = ''
        OR p_tag = ANY (p.tags)
      )
  ),
  filtered AS (
    SELECT *
    FROM base
    WHERE
      p_stock_status = 'all'
      OR (p_stock_status = 'out' AND available <= 0)
      OR (
        p_stock_status = 'low'
        AND min_stock > 0
        AND available < min_stock
      )
      OR (
        p_stock_status = 'ok'
        AND (min_stock = 0 OR available >= min_stock)
        AND available > 0
      )
  )
  SELECT
    f.variant_id,
    f.product_id,
    f.product_title,
    f.variant_title,
    f.sku,
    f.barcode,
    f.vendor,
    f.tags,
    f.image_url,
    f.available,
    f.min_stock,
    f.max_stock,
    COUNT(*) OVER () AS total_count
  FROM filtered f
  ORDER BY f.product_title, f.variant_title
  LIMIT GREATEST(p_limit, 1)
  OFFSET GREATEST(p_offset, 0);
$$;
