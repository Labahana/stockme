import { createAdminClient } from "@/lib/supabase/admin";

export type InventoryListParams = {
  shopId: string;
  locationId: string;
  search?: string;
  stockStatus?: string;
  tag?: string;
  vendor?: string;
  page?: number;
  limit?: number;
};

export type InventoryRow = {
  variant_id: string;
  product_id: string;
  product_title: string;
  variant_title: string;
  sku: string | null;
  barcode: string | null;
  vendor: string | null;
  tags: string[] | null;
  image_url: string | null;
  available: number;
  min_stock: number;
  max_stock: number | null;
  total_count: number;
};

export async function fetchInventoryList(params: InventoryListParams) {
  const supabase = createAdminClient();
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 10_000);
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * limit;

  const { data, error } = await supabase.rpc("inventory_list", {
    p_shop_id: params.shopId,
    p_location_id: params.locationId,
    p_search: params.search ?? null,
    p_stock_status: params.stockStatus ?? "all",
    p_tag: params.tag ?? null,
    p_vendor: params.vendor ?? null,
    p_limit: limit,
    p_offset: offset,
  });

  if (error) throw error;

  const rows = (data ?? []) as InventoryRow[];
  const total = rows[0]?.total_count ?? 0;

  return {
    items: rows.map((row) => {
      const { total_count, ...item } = row;
      void total_count;
      return item;
    }),
    pagination: {
      page,
      limit,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / limit) || 1,
    },
  };
}

export async function fetchLocations(shopId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("locations")
    .select("id, name, is_primary, active")
    .eq("shop_id", shopId)
    .eq("active", true)
    .order("is_primary", { ascending: false })
    .order("name");

  if (error) throw error;
  return data ?? [];
}

export async function fetchStoreTags(shopId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("store_tags", {
    p_shop_id: shopId,
  });

  if (!error && data) {
    return (data as { tag: string }[]).map((r) => r.tag);
  }

  // Fallback if migration 005 not applied yet
  const { data: rows, error: fallbackError } = await supabase
    .from("products")
    .select("tags")
    .eq("shop_id", shopId)
    .limit(500);
  if (fallbackError) throw fallbackError;

  const tagSet = new Set<string>();
  for (const row of rows ?? []) {
    for (const tag of row.tags ?? []) {
      if (tag) tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
}

export async function fetchStoreVendors(shopId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("store_vendors", {
    p_shop_id: shopId,
  });

  if (!error && data) {
    return (data as { vendor: string }[]).map((r) => r.vendor);
  }

  const { data: rows, error: fallbackError } = await supabase
    .from("products")
    .select("vendor")
    .eq("shop_id", shopId)
    .not("vendor", "is", null)
    .limit(50_000);
  if (fallbackError) throw fallbackError;

  const vendorSet = new Set<string>();
  for (const row of rows ?? []) {
    if (row.vendor?.trim()) vendorSet.add(row.vendor.trim());
  }
  return Array.from(vendorSet).sort();
}

export type ConsolidatedRow = {
  variant_id: string;
  product_title: string;
  variant_title: string;
  sku: string | null;
  barcode: string | null;
  total_available: number;
  by_location: { location_id: string; location_name: string; available: number }[];
};

export async function fetchConsolidatedInventory(
  shopId: string,
  params: { search?: string; page?: number; limit?: number },
) {
  const supabase = createAdminClient();
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 10_000);
  const page = Math.max(params.page ?? 1, 1);
  const offset = (page - 1) * limit;

  let variantQuery = supabase
    .from("variants")
    .select(
      `id, sku, barcode, title, products(title),
       inventory_levels(available, location_id, locations(name))`,
      { count: "exact" },
    )
    .eq("shop_id", shopId)
    .order("sku", { ascending: true })
    .range(offset, offset + limit - 1);

  if (params.search) {
    variantQuery = variantQuery.or(
      `sku.ilike.%${params.search}%,title.ilike.%${params.search}%,barcode.ilike.%${params.search}%`,
    );
  }

  const { data, error, count } = await variantQuery;
  if (error) throw error;

  const items: ConsolidatedRow[] = (data ?? []).map((v) => {
    const product = Array.isArray(v.products) ? v.products[0] : v.products;
    const levels = Array.isArray(v.inventory_levels)
      ? v.inventory_levels
      : v.inventory_levels
        ? [v.inventory_levels]
        : [];

    const by_location = levels.map((l) => {
      const loc = Array.isArray(l.locations) ? l.locations[0] : l.locations;
      return {
        location_id: l.location_id,
        location_name: loc?.name ?? "",
        available: l.available ?? 0,
      };
    });

    return {
      variant_id: v.id,
      product_title: product?.title ?? "",
      variant_title: v.title,
      sku: v.sku,
      barcode: v.barcode,
      total_available: by_location.reduce((s, l) => s + l.available, 0),
      by_location,
    };
  });

  const total = count ?? 0;
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}
