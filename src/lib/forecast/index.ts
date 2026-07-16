import { getGraphqlClient } from "@/lib/shopify";
import { shopifyGql } from "@/lib/shopify/graphql";
import { parseShopifyGid } from "@/lib/shopify/gid";
import type { ForecastMethod } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";

export type ForecastParams = {
  method: ForecastMethod;
  days?: number;
  startDate?: string;
  endDate?: string;
  targetStock?: number;
};

export type ForecastLine = {
  variantId: string;
  sku: string | null;
  title: string;
  available: number;
  suggestedQty: number;
  reorderQty: number;
};

const ORDERS_QUERY = `
  query SalesVelocity($query: String!, $cursor: String) {
    orders(first: 100, after: $cursor, query: $query) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          lineItems(first: 50) {
            edges {
              node {
                quantity
                variant { id }
              }
            }
          }
        }
      }
    }
  }
`;

/** Cap Shopify order pages so forecast stays responsive on large stores. */
const MAX_ORDER_PAGES = 100;

type OrdersQueryResult = {
  orders: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: {
      node: {
        lineItems: {
          edges: { node: { quantity: number; variant: { id: string } | null } }[];
        };
      };
    }[];
  };
};

export async function fetchSalesByVariant(
  shop: string,
  queryFilter: string,
): Promise<Map<number, number>> {
  const client = await getGraphqlClient(shop);
  const sales = new Map<number, number>();
  let cursor: string | null = null;
  let pages = 0;

  do {
    const data: OrdersQueryResult = await shopifyGql(
      client,
      ORDERS_QUERY,
      { query: queryFilter, cursor },
    );

    for (const { node: order } of data.orders.edges) {
      for (const { node: line } of order.lineItems.edges) {
        if (!line.variant?.id) continue;
        const variantId = parseShopifyGid(line.variant.id);
        sales.set(variantId, (sales.get(variantId) ?? 0) + line.quantity);
      }
    }

    pages += 1;
    cursor =
      data.orders.pageInfo.hasNextPage && pages < MAX_ORDER_PAGES
        ? data.orders.pageInfo.endCursor
        : null;
  } while (cursor);

  return sales;
}

function roundToPack(qty: number, packSize: number, moq: number) {
  if (qty <= 0) return 0;
  const packs = Math.ceil(qty / packSize);
  return Math.max(packs * packSize, moq);
}

function dateQuery(since: string, until?: string) {
  return until
    ? `created_at:>=${since} created_at:<=${until}`
    : `created_at:>=${since}`;
}

type ForecastVariantRow = {
  id: string;
  sku: string | null;
  title: string;
  shopify_variant_id: number;
  inventory_levels:
    | { available: number; location_id: string }
    | { available: number; location_id: string }[]
    | null;
  variant_location_settings:
    | {
        min_stock: number;
        max_stock: number | null;
        target_stock: number | null;
        location_id: string;
      }
    | {
        min_stock: number;
        max_stock: number | null;
        target_stock: number | null;
        location_id: string;
      }[]
    | null;
  supplier_products:
    | { pack_size: number; moq: number }
    | { pack_size: number; moq: number }[]
    | null;
};

async function loadForecastVariants(
  shopId: string,
  locationId: string,
  variantIds: string[] | null,
): Promise<ForecastVariantRow[]> {
  const supabase = createAdminClient();
  const pageSize = 1000;
  const all: ForecastVariantRow[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("variants")
      .select(
        `id, sku, title, shopify_variant_id,
         inventory_levels!inner(available, location_id),
         variant_location_settings(min_stock, max_stock, target_stock, location_id),
         supplier_products(pack_size, moq)`,
      )
      .eq("shop_id", shopId)
      .eq("inventory_levels.location_id", locationId)
      .range(from, from + pageSize - 1);

    if (variantIds) {
      query = query.in("id", variantIds);
    }

    const { data, error } = await query;
    if (error) throw error;
    const batch = (data ?? []) as ForecastVariantRow[];
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

export async function computeForecastLines(
  shop: string,
  shopId: string,
  locationId: string,
  supplierId: string | null,
  params: ForecastParams,
  leadTimeDays = 7,
): Promise<ForecastLine[]> {
  const supabase = createAdminClient();

  let variantIds: string[] | null = null;
  if (supplierId) {
    const { data: links } = await supabase
      .from("supplier_products")
      .select("variant_id")
      .eq("shop_id", shopId)
      .eq("supplier_id", supplierId);
    variantIds = (links ?? []).map((l) => l.variant_id);
    if (variantIds.length === 0) return [];
  }

  const needsSales =
    params.method === "last_x_days" ||
    params.method === "custom_range" ||
    params.method === "same_period_last_year";

  let salesPromise: Promise<Map<number, number>> | null = null;
  if (needsSales) {
    const now = new Date();
    let since: string;
    let until: string | undefined;

    if (params.method === "last_x_days") {
      const days = params.days ?? 30;
      since = new Date(now.getTime() - days * 86400000).toISOString().slice(0, 10);
    } else if (params.method === "custom_range") {
      since =
        params.startDate ??
        new Date(now.getTime() - 30 * 86400000).toISOString().slice(0, 10);
      until = params.endDate ?? now.toISOString().slice(0, 10);
    } else {
      const start = new Date(now);
      start.setFullYear(start.getFullYear() - 1);
      const end = new Date(start);
      end.setDate(end.getDate() + (params.days ?? 30));
      since = start.toISOString().slice(0, 10);
      until = end.toISOString().slice(0, 10);
    }

    salesPromise = fetchSalesByVariant(shop, dateQuery(since, until));
  }

  const [variants, salesMap] = await Promise.all([
    loadForecastVariants(shopId, locationId, variantIds),
    salesPromise ?? Promise.resolve(new Map<number, number>()),
  ]);

  const lines: ForecastLine[] = [];

  for (const v of variants) {
    const inv = Array.isArray(v.inventory_levels)
      ? v.inventory_levels.find((i) => i.location_id === locationId)
      : v.inventory_levels;
    const settings = Array.isArray(v.variant_location_settings)
      ? v.variant_location_settings.find((s) => s.location_id === locationId)
      : v.variant_location_settings;
    const supplierLink = Array.isArray(v.supplier_products)
      ? v.supplier_products[0]
      : v.supplier_products;

    const available = inv?.available ?? 0;
    const packSize = supplierLink?.pack_size ?? 1;
    const moq = supplierLink?.moq ?? 1;

    let suggested = 0;

    switch (params.method) {
      case "last_x_days": {
        const days = params.days ?? 30;
        const sold = salesMap.get(v.shopify_variant_id) ?? 0;
        const daily = sold / days;
        suggested = Math.ceil(daily * leadTimeDays + (settings?.min_stock ?? 0));
        break;
      }
      case "custom_range":
      case "same_period_last_year": {
        const sold = salesMap.get(v.shopify_variant_id) ?? 0;
        suggested = Math.max(sold, settings?.min_stock ?? 0);
        break;
      }
      case "fill_shelves":
        suggested = settings?.max_stock ?? settings?.target_stock ?? available;
        break;
      case "target_stock_level":
        suggested =
          params.targetStock ?? settings?.target_stock ?? settings?.max_stock ?? 0;
        break;
    }

    const reorderQty = roundToPack(Math.max(suggested - available, 0), packSize, moq);
    if (reorderQty <= 0) continue;

    lines.push({
      variantId: v.id,
      sku: v.sku,
      title: v.title,
      available,
      suggestedQty: suggested,
      reorderQty,
    });
  }

  return lines.sort((a, b) => b.reorderQty - a.reorderQty);
}
