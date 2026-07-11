-- Stockme: initial schema (Stocky 1:1 clone)
-- RLS: service-role API routes filter by shop_id; anon/authenticated denied by default.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Stores & sessions
-- ---------------------------------------------------------------------------

CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_domain TEXT NOT NULL UNIQUE,
  plan_tier TEXT NOT NULL DEFAULT 'starter' CHECK (plan_tier IN ('starter', 'growth', 'pro')),
  billing_status TEXT NOT NULL DEFAULT 'trial' CHECK (billing_status IN ('trial', 'active', 'cancelled', 'frozen')),
  shopify_shop_id BIGINT,
  email TEXT,
  timezone TEXT,
  currency TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE shopify_sessions (
  id TEXT PRIMARY KEY,
  shop TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT '',
  is_online BOOLEAN NOT NULL DEFAULT false,
  scope TEXT,
  expires TIMESTAMPTZ,
  access_token TEXT,
  refresh_token TEXT,
  refresh_token_expires TIMESTAMPTZ,
  online_access_info JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shopify_sessions_shop ON shopify_sessions (shop);

-- ---------------------------------------------------------------------------
-- Shopify catalog mirror
-- ---------------------------------------------------------------------------

CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  shopify_location_id BIGINT NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, shopify_location_id)
);

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  shopify_product_id BIGINT NOT NULL,
  title TEXT NOT NULL,
  vendor TEXT,
  product_type TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  tags TEXT[] NOT NULL DEFAULT '{}',
  image_url TEXT,
  is_bundle BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, shopify_product_id)
);

CREATE TABLE variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  shopify_variant_id BIGINT NOT NULL,
  shopify_inventory_item_id BIGINT,
  title TEXT NOT NULL,
  sku TEXT,
  barcode TEXT,
  price NUMERIC(12, 2),
  cost NUMERIC(12, 4),
  tracked BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, shopify_variant_id)
);

CREATE INDEX idx_variants_shop_sku ON variants (shop_id, sku);
CREATE INDEX idx_variants_shop_barcode ON variants (shop_id, barcode);
CREATE INDEX idx_variants_product ON variants (product_id);

CREATE TABLE variant_location_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES variants (id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
  min_stock INTEGER NOT NULL DEFAULT 0,
  max_stock INTEGER,
  target_stock INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (variant_id, location_id)
);

CREATE TABLE inventory_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES variants (id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations (id) ON DELETE CASCADE,
  available INTEGER NOT NULL DEFAULT 0,
  committed INTEGER NOT NULL DEFAULT 0,
  on_hand INTEGER NOT NULL DEFAULT 0,
  shopify_inventory_level_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (variant_id, location_id)
);

CREATE INDEX idx_inventory_levels_shop_location ON inventory_levels (shop_id, location_id);
CREATE INDEX idx_inventory_levels_variant ON inventory_levels (variant_id);

-- Bundle component costs (fix Stocky parent+child double-count)
CREATE TABLE bundle_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  parent_variant_id UUID NOT NULL REFERENCES variants (id) ON DELETE CASCADE,
  child_variant_id UUID NOT NULL REFERENCES variants (id) ON DELETE CASCADE,
  quantity NUMERIC(12, 4) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_variant_id, child_variant_id)
);

-- ---------------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------------

CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  lead_time_days INTEGER NOT NULL DEFAULT 7,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suppliers_shop ON suppliers (shop_id);

CREATE TABLE supplier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers (id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES variants (id) ON DELETE CASCADE,
  supplier_sku TEXT,
  pack_size INTEGER NOT NULL DEFAULT 1,
  moq INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC(12, 4),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (supplier_id, variant_id)
);

-- ---------------------------------------------------------------------------
-- Purchase orders
-- ---------------------------------------------------------------------------

CREATE TYPE po_status AS ENUM ('draft', 'sent', 'partially_received', 'received', 'cancelled');

CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers (id),
  location_id UUID NOT NULL REFERENCES locations (id),
  po_number TEXT NOT NULL,
  status po_status NOT NULL DEFAULT 'draft',
  forecast_method TEXT,
  forecast_params JSONB,
  notes TEXT,
  expected_at DATE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, po_number)
);

CREATE INDEX idx_purchase_orders_shop_status ON purchase_orders (shop_id, status);

CREATE TABLE po_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders (id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES variants (id),
  ordered_qty INTEGER NOT NULL,
  received_qty INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC(12, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Partial receiving per shipment + invoice (Stocky bug #9)
CREATE TABLE po_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders (id) ON DELETE CASCADE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE po_receipt_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  po_receipt_id UUID NOT NULL REFERENCES po_receipts (id) ON DELETE CASCADE,
  po_line_item_id UUID NOT NULL REFERENCES po_line_items (id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE po_receipt_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  po_receipt_id UUID NOT NULL REFERENCES po_receipts (id) ON DELETE CASCADE,
  invoice_number TEXT,
  invoice_amount NUMERIC(12, 2),
  invoiced_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Stocktakes
-- ---------------------------------------------------------------------------

CREATE TYPE stocktake_status AS ENUM ('in_progress', 'completed', 'cancelled');

CREATE TABLE stocktakes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations (id),
  name TEXT NOT NULL,
  status stocktake_status NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE stocktake_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  stocktake_id UUID NOT NULL REFERENCES stocktakes (id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES variants (id),
  system_qty INTEGER NOT NULL DEFAULT 0,
  counted_qty INTEGER,
  barcode_scanned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stocktake_id, variant_id)
);

-- ---------------------------------------------------------------------------
-- Stock transfers
-- ---------------------------------------------------------------------------

CREATE TYPE transfer_status AS ENUM ('draft', 'in_transit', 'received', 'cancelled');

CREATE TABLE stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  transfer_number TEXT NOT NULL,
  from_location_id UUID NOT NULL REFERENCES locations (id),
  to_location_id UUID NOT NULL REFERENCES locations (id),
  status transfer_status NOT NULL DEFAULT 'draft',
  shipped_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, transfer_number)
);

CREATE TABLE stock_transfer_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  stock_transfer_id UUID NOT NULL REFERENCES stock_transfers (id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES variants (id),
  quantity INTEGER NOT NULL,
  received_qty INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Sync audit
-- ---------------------------------------------------------------------------

CREATE TABLE sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'webhook', 'force')),
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  items_processed INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);

CREATE INDEX idx_sync_runs_shop_started ON sync_runs (shop_id, started_at DESC);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stores_updated_at BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER shopify_sessions_updated_at BEFORE UPDATE ON shopify_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER variants_updated_at BEFORE UPDATE ON variants FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER variant_location_settings_updated_at BEFORE UPDATE ON variant_location_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER suppliers_updated_at BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER supplier_products_updated_at BEFORE UPDATE ON supplier_products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER po_line_items_updated_at BEFORE UPDATE ON po_line_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER stock_transfers_updated_at BEFORE UPDATE ON stock_transfers FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE variant_location_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_receipt_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_receipt_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocktakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stocktake_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_transfer_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;

-- Deny direct client access; API routes use service role with explicit shop_id filters.
CREATE POLICY deny_anon ON stores FOR ALL TO anon USING (false);
CREATE POLICY deny_authenticated ON stores FOR ALL TO authenticated USING (false);
