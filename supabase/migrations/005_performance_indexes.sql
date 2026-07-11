-- Performance indexes + optimized inventory_list for 5k+ SKU shops

-- Hot-path indexes for inventory list joins/filters
CREATE INDEX IF NOT EXISTS idx_products_shop_status
  ON products (shop_id, status);

CREATE INDEX IF NOT EXISTS idx_products_shop_vendor
  ON products (shop_id, vendor)
  WHERE vendor IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_shop_title
  ON products (shop_id, title);

CREATE INDEX IF NOT EXISTS idx_variants_shop_id
  ON variants (shop_id);

CREATE INDEX IF NOT EXISTS idx_inventory_levels_variant_location
  ON inventory_levels (variant_id, location_id);

CREATE INDEX IF NOT EXISTS idx_vls_variant_location
  ON variant_location_settings (variant_id, location_id);

CREATE INDEX IF NOT EXISTS idx_supplier_products_shop_supplier
  ON supplier_products (shop_id, supplier_id);

CREATE INDEX IF NOT EXISTS idx_supplier_products_variant
  ON supplier_products (variant_id);

-- GIN for tag containment (p_tag = ANY tags)
CREATE INDEX IF NOT EXISTS idx_products_tags_gin
  ON products USING GIN (tags);

-- Distinct vendors helper (avoids scanning 2k product rows in app)
CREATE OR REPLACE FUNCTION store_vendors(p_shop_id UUID)
RETURNS TABLE (vendor TEXT)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT p.vendor
  FROM products p
  WHERE p.shop_id = p_shop_id
    AND p.vendor IS NOT NULL
    AND btrim(p.vendor) <> ''
  ORDER BY 1;
$$;

-- Distinct tags helper
CREATE OR REPLACE FUNCTION store_tags(p_shop_id UUID)
RETURNS TABLE (tag TEXT)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT t.tag
  FROM products p
  CROSS JOIN LATERAL unnest(p.tags) AS t(tag)
  WHERE p.shop_id = p_shop_id
    AND t.tag IS NOT NULL
    AND btrim(t.tag) <> ''
  ORDER BY 1;
$$;

-- Optimized inventory_list: filter early, join only needed rows
CREATE OR REPLACE FUNCTION inventory_list(
  p_shop_id UUID,
  p_location_id UUID,
  p_search TEXT DEFAULT NULL,
  p_stock_status TEXT DEFAULT 'all',
  p_tag TEXT DEFAULT NULL,
  p_vendor TEXT DEFAULT NULL,
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
  WITH filtered AS (
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
    INNER JOIN products p
      ON p.id = v.product_id
     AND p.shop_id = p_shop_id
     AND p.status = 'active'
    LEFT JOIN inventory_levels il
      ON il.variant_id = v.id
     AND il.location_id = p_location_id
    LEFT JOIN variant_location_settings vls
      ON vls.variant_id = v.id
     AND vls.location_id = p_location_id
    WHERE v.shop_id = p_shop_id
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
      AND (
        p_vendor IS NULL
        OR p_vendor = ''
        OR p.vendor = p_vendor
      )
      AND (
        p_stock_status = 'all'
        OR (p_stock_status = 'out' AND COALESCE(il.available, 0) <= 0)
        OR (
          p_stock_status = 'low'
          AND COALESCE(vls.min_stock, 0) > 0
          AND COALESCE(il.available, 0) < COALESCE(vls.min_stock, 0)
        )
        OR (
          p_stock_status = 'ok'
          AND (COALESCE(vls.min_stock, 0) = 0 OR COALESCE(il.available, 0) >= COALESCE(vls.min_stock, 0))
          AND COALESCE(il.available, 0) > 0
        )
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
