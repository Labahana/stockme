import { createAdminClient } from "@/lib/supabase/admin";
import { getBundleChildVariantIds } from "@/lib/sync/bundle-components";

type CostCache = Map<string, number>;

function createCostCache(): CostCache {
  return new Map<string, number>();
}

async function effectiveCost(
  shopId: string,
  variantId: string,
  baseCost: number,
  cache: CostCache,
): Promise<number> {
  const key = `${shopId}:${variantId}`;
  if (cache.has(key)) return cache.get(key)!;

  const supabase = createAdminClient();
  const { data: components } = await supabase
    .from("bundle_components")
    .select("quantity, variants:child_variant_id(cost)")
    .eq("shop_id", shopId)
    .eq("parent_variant_id", variantId);

  if (!components?.length) {
    cache.set(key, baseCost);
    return baseCost;
  }

  let bundleCost = 0;
  for (const c of components) {
    const child = Array.isArray(c.variants) ? c.variants[0] : c.variants;
    bundleCost += Number(child?.cost ?? 0) * Number(c.quantity);
  }
  const cost = bundleCost || baseCost;
  cache.set(key, cost);
  return cost;
}

export async function reportLowStock(shopId: string, locationId?: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("variants")
    .select(
      `sku, title, products(title),
       inventory_levels(available, location_id, locations(name)),
       variant_location_settings(min_stock, location_id)`,
    )
    .eq("shop_id", shopId)
    .limit(5000);

  if (error) throw error;

  const rows = (data ?? [])
    .flatMap((v) => {
      const levels = Array.isArray(v.inventory_levels)
        ? v.inventory_levels
        : v.inventory_levels
          ? [v.inventory_levels]
          : [];
      const settings = Array.isArray(v.variant_location_settings)
        ? v.variant_location_settings
        : v.variant_location_settings
          ? [v.variant_location_settings]
          : [];
      const product = Array.isArray(v.products) ? v.products[0] : v.products;

      return levels
        .filter((l) => l && (!locationId || l.location_id === locationId))
        .map((l) => {
          const setting = settings.find((s) => s.location_id === l.location_id);
          const min = setting?.min_stock ?? 0;
          if (min <= 0 || l.available >= min) return null;
          const loc = Array.isArray(l.locations) ? l.locations[0] : l.locations;
          return {
            product: product?.title ?? "",
            variant: v.title,
            sku: v.sku ?? "",
            location: loc?.name ?? "",
            available: l.available,
            min_stock: min,
            shortfall: min - l.available,
          };
        })
        .filter(Boolean);
    }) as {
    product: string;
    variant: string;
    sku: string;
    location: string;
    available: number;
    min_stock: number;
    shortfall: number;
  }[];

  const totalShortfall = rows.reduce((sum, r) => sum + r.shortfall, 0);
  return { rows, totals: { count: rows.length, totalShortfall } };
}

export async function reportValuation(shopId: string, locationId?: string) {
  const supabase = createAdminClient();
  const bundleChildren = await getBundleChildVariantIds(shopId);
  const cache = createCostCache();
  const { data, error } = await supabase
    .from("variants")
    .select(
      `id, sku, title, cost, products(title),
       inventory_levels(available, location_id, locations(name))`,
    )
    .eq("shop_id", shopId)
    .limit(5000);

  if (error) throw error;

  const rows: {
    product: string;
    variant: string;
    sku: string;
    location: string;
    available: number;
    unit_cost: number;
    value: number;
  }[] = [];

  for (const v of data ?? []) {
    if (bundleChildren.has(v.id)) continue;

    const unitCost = await effectiveCost(shopId, v.id, Number(v.cost ?? 0), cache);
    const levels = Array.isArray(v.inventory_levels)
      ? v.inventory_levels
      : v.inventory_levels
        ? [v.inventory_levels]
        : [];
    const product = Array.isArray(v.products) ? v.products[0] : v.products;

    for (const l of levels) {
      if (!l || (locationId && l.location_id !== locationId)) continue;
      const loc = Array.isArray(l.locations) ? l.locations[0] : l.locations;
      const value = (l.available ?? 0) * unitCost;
      rows.push({
        product: product?.title ?? "",
        variant: v.title,
        sku: v.sku ?? "",
        location: loc?.name ?? "",
        available: l.available ?? 0,
        unit_cost: unitCost,
        value: Math.round(value * 100) / 100,
      });
    }
  }

  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  return { rows, totals: { count: rows.length, totalValue } };
}

export async function reportSupplierPerformance(shopId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      `status, suppliers(name), po_line_items(ordered_qty, received_qty, unit_cost)`,
    )
    .eq("shop_id", shopId)
    .neq("status", "cancelled");

  if (error) throw error;

  const bySupplier = new Map<
    string,
    { supplier: string; orders: number; ordered: number; received: number; spend: number }
  >();

  for (const po of data ?? []) {
    const supplier = Array.isArray(po.suppliers) ? po.suppliers[0] : po.suppliers;
    const name = supplier?.name ?? "Unknown";
    const entry = bySupplier.get(name) ?? {
      supplier: name,
      orders: 0,
      ordered: 0,
      received: 0,
      spend: 0,
    };
    entry.orders += 1;
    const lines = Array.isArray(po.po_line_items) ? po.po_line_items : [];
    for (const line of lines) {
      entry.ordered += line.ordered_qty;
      entry.received += line.received_qty;
      entry.spend += line.received_qty * Number(line.unit_cost);
    }
    bySupplier.set(name, entry);
  }

  const rows = Array.from(bySupplier.values());
  return {
    rows,
    totals: {
      suppliers: rows.length,
      totalSpend: rows.reduce((s, r) => s + r.spend, 0),
      totalOrdered: rows.reduce((s, r) => s + r.ordered, 0),
      totalReceived: rows.reduce((s, r) => s + r.received, 0),
    },
  };
}

export async function reportCogs(shopId: string, days = 30) {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const cache = createCostCache();

  const { data: pos, error } = await supabase
    .from("po_receipts")
    .select(
      `received_at,
       po_receipt_lines(quantity, po_line_items(unit_cost, variant_id, variants(title, sku, cost)))`,
    )
    .eq("shop_id", shopId)
    .gte("received_at", since);

  if (error) throw error;

  const rows: {
    date: string;
    sku: string;
    variant: string;
    qty: number;
    unit_cost: number;
    cogs: number;
  }[] = [];

  for (const receipt of pos ?? []) {
    const lines = Array.isArray(receipt.po_receipt_lines)
      ? receipt.po_receipt_lines
      : [];
    for (const line of lines) {
      const poLine = Array.isArray(line.po_line_items)
        ? line.po_line_items[0]
        : line.po_line_items;
      const variant = poLine?.variants
        ? Array.isArray(poLine.variants)
          ? poLine.variants[0]
          : poLine.variants
        : null;
      const variantId = poLine?.variant_id as string | undefined;
      const baseCost = Number(poLine?.unit_cost ?? variant?.cost ?? 0);
      const unitCost = variantId
        ? await effectiveCost(shopId, variantId, baseCost, cache)
        : baseCost;
      const cost = line.quantity * unitCost;
      rows.push({
        date: receipt.received_at?.slice(0, 10) ?? "",
        sku: variant?.sku ?? "",
        variant: variant?.title ?? "",
        qty: line.quantity,
        unit_cost: Math.round(unitCost * 100) / 100,
        cogs: Math.round(cost * 100) / 100,
      });
    }
  }

  const totalCogs = rows.reduce((s, r) => s + r.cogs, 0);
  return { rows, totals: { count: rows.length, totalCogs } };
}

export async function reportSellThrough(
  shop: string,
  shopId: string,
  days = 30,
) {
  const supabase = createAdminClient();
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { fetchSalesByVariant } = await import("@/lib/forecast");
  const salesMap = await fetchSalesByVariant(shop, `created_at:>=${since}`);

  const { data: variants, error } = await supabase
    .from("variants")
    .select(`id, sku, title, shopify_variant_id, inventory_levels(available)`)
    .eq("shop_id", shopId)
    .limit(5000);

  if (error) throw error;

  const rows = (variants ?? [])
    .map((v) => {
      const levels = Array.isArray(v.inventory_levels)
        ? v.inventory_levels
        : v.inventory_levels
          ? [v.inventory_levels]
          : [];
      const available = levels.reduce((s, l) => s + (l.available ?? 0), 0);
      const sold = salesMap.get(v.shopify_variant_id) ?? 0;
      const denom = sold + available;
      const pct = denom > 0 ? Math.round((sold / denom) * 1000) / 10 : 0;
      return {
        sku: v.sku ?? "",
        variant: v.title,
        units_sold: sold,
        available,
        sell_through_pct: pct,
      };
    })
    .filter((r) => r.units_sold > 0)
    .sort((a, b) => b.sell_through_pct - a.sell_through_pct)
    .slice(0, 500);

  const avgSellThrough =
    rows.length > 0
      ? Math.round(
          (rows.reduce((s, r) => s + r.sell_through_pct, 0) / rows.length) * 10,
        ) / 10
      : 0;

  return { rows, totals: { count: rows.length, avgSellThrough, days } };
}
