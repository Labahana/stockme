import { createAdminClient } from "@/lib/supabase/admin";
import { getGraphqlClient } from "@/lib/shopify";
import { shopifyGql } from "@/lib/shopify/graphql";
import { parseShopifyGid } from "@/lib/shopify/gid";
import { runBundleComponentSync } from "@/lib/sync/bundle-components";

export type SyncStats = {
  locations: number;
  products: number;
  variants: number;
  inventoryLevels: number;
  bundleParents: number;
  bundleComponents: number;
};

type LocationNode = {
  id: string;
  name: string;
  isActive: boolean;
};

type VariantNode = {
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: string;
  inventoryItem: {
    id: string;
    tracked: boolean;
    unitCost: { amount: string } | null;
  };
};

type VariantsPage = {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  edges: { node: VariantNode }[];
};

type ProductNode = {
  id: string;
  title: string;
  vendor: string | null;
  productType: string | null;
  status: string;
  tags: string[];
  featuredImage: { url: string } | null;
  variants: VariantsPage;
};

type ProductsQueryResult = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: { node: ProductNode }[];
  };
};

type LocationsQueryResult = {
  locations: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: { node: LocationNode }[];
  };
};

type ProductVariantsQueryResult = {
  product: { variants: VariantsPage };
};

const LOCATIONS_QUERY = `
  query SyncLocations($cursor: String) {
    locations(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node { id name isActive }
      }
    }
  }
`;

// Keep nested page sizes small — Shopify caps a single query at cost 1000.
// 25×100 variants + inventoryItem/unitCost was ~2672 and failed force sync.
const PRODUCTS_PAGE_SIZE = 5;
const VARIANTS_PAGE_SIZE = 25;

const PRODUCTS_QUERY = `
  query SyncProducts($cursor: String) {
    products(first: ${PRODUCTS_PAGE_SIZE}, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          vendor
          productType
          status
          tags
          featuredImage { url }
          variants(first: ${VARIANTS_PAGE_SIZE}) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                id
                title
                sku
                barcode
                price
                inventoryItem {
                  id
                  tracked
                  unitCost { amount }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const PRODUCT_VARIANTS_QUERY = `
  query SyncProductVariants($productId: ID!, $cursor: String) {
    product(id: $productId) {
      variants(first: ${VARIANTS_PAGE_SIZE}, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id
            title
            sku
            barcode
            price
            inventoryItem {
              id
              tracked
              unitCost { amount }
            }
          }
        }
      }
    }
  }
`;

// InventoryLevel.available was removed; use quantities(names: [...]) on API 2026-07+.
// https://shopify.dev/docs/api/admin-graphql/latest/objects/InventoryLevel
const VARIANT_INVENTORY_QUERY = `
  query SyncVariantInventory($itemId: ID!, $cursor: String) {
    inventoryItem(id: $itemId) {
      inventoryLevels(first: 50, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id
            quantities(names: ["available", "on_hand", "committed"]) {
              name
              quantity
            }
            location { id }
          }
        }
      }
    }
  }
`;

type InventoryQuantity = { name: string; quantity: number };

type VariantInventoryQueryResult = {
  inventoryItem: {
    inventoryLevels: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: {
        node: {
          id: string;
          quantities: InventoryQuantity[];
          location: { id: string };
        };
      }[];
    };
  };
};

function qtyNamed(
  quantities: InventoryQuantity[] | null | undefined,
  name: string,
): number {
  return quantities?.find((q) => q.name === name)?.quantity ?? 0;
}

export async function runFullCatalogSync(
  shop: string,
  shopId: string,
): Promise<SyncStats> {
  const stats: SyncStats = {
    locations: 0,
    products: 0,
    variants: 0,
    inventoryLevels: 0,
    bundleParents: 0,
    bundleComponents: 0,
  };

  await runCatalogSyncStep(shop, shopId, { phase: "locations", cursor: null }, stats);

  let productCursor: string | null = null;
  do {
    const step = await runCatalogSyncStep(
      shop,
      shopId,
      { phase: "products", cursor: productCursor },
      stats,
    );
    productCursor = step.nextCursor;
  } while (productCursor);

  await runCatalogSyncStep(shop, shopId, { phase: "bundles", cursor: null }, stats);
  return stats;
}

export type CatalogSyncStepInput = {
  phase: "locations" | "products" | "bundles";
  cursor: string | null;
};

export type CatalogSyncStepResult = {
  nextPhase: "locations" | "products" | "bundles" | "completed";
  nextCursor: string | null;
  pageProducts: number;
  pageVariants: number;
  pageInventory: number;
  pageLocations: number;
};

/**
 * One free-tier-safe sync step (locations OR one product page OR bundles).
 * Call repeatedly until nextPhase === "completed".
 */
export async function runCatalogSyncStep(
  shop: string,
  shopId: string,
  input: CatalogSyncStepInput,
  stats?: SyncStats,
): Promise<CatalogSyncStepResult> {
  const client = await getGraphqlClient(shop);
  const supabase = createAdminClient();
  const local: SyncStats = stats ?? {
    locations: 0,
    products: 0,
    variants: 0,
    inventoryLevels: 0,
    bundleParents: 0,
    bundleComponents: 0,
  };

  if (input.phase === "locations") {
    await syncLocations(client, supabase, shopId, local);
    return {
      nextPhase: "products",
      nextCursor: null,
      pageProducts: 0,
      pageVariants: 0,
      pageInventory: 0,
      pageLocations: local.locations,
    };
  }

  if (input.phase === "bundles") {
    const bundleStats = await runBundleComponentSync(shop, shopId);
    local.bundleParents = bundleStats.bundleParents;
    local.bundleComponents = bundleStats.bundleComponents;
    return {
      nextPhase: "completed",
      nextCursor: null,
      pageProducts: 0,
      pageVariants: 0,
      pageInventory: 0,
      pageLocations: 0,
    };
  }

  // products phase — one GraphQL page (kept small for Shopify query-cost cap)
  const before = {
    products: local.products,
    variants: local.variants,
    inventoryLevels: local.inventoryLevels,
  };

  const { data: locs } = await supabase
    .from("locations")
    .select("id, shopify_location_id")
    .eq("shop_id", shopId);
  const locationMap = new Map<number, string>();
  for (const loc of locs ?? []) {
    locationMap.set(loc.shopify_location_id, loc.id);
  }

  const data: ProductsQueryResult = await shopifyGql(client, PRODUCTS_QUERY, {
    cursor: input.cursor,
  });

  for (const { node: product } of data.products.edges) {
    await syncProduct(client, supabase, shopId, product, locationMap, local);
  }

  const hasMore = data.products.pageInfo.hasNextPage;
  const nextCursor = hasMore ? data.products.pageInfo.endCursor : null;

  return {
    nextPhase: hasMore ? "products" : "bundles",
    nextCursor,
    pageProducts: local.products - before.products,
    pageVariants: local.variants - before.variants,
    pageInventory: local.inventoryLevels - before.inventoryLevels,
    pageLocations: 0,
  };
}

async function syncLocations(
  client: Awaited<ReturnType<typeof getGraphqlClient>>,
  supabase: ReturnType<typeof createAdminClient>,
  shopId: string,
  stats: SyncStats,
) {
  const locationMap = new Map<number, string>();
  let cursor: string | null = null;
  let isPrimarySet = false;

  do {
    const data: LocationsQueryResult = await shopifyGql(
      client,
      LOCATIONS_QUERY,
      { cursor },
    );

    const rows = data.locations.edges.map(({ node }, index) => {
      const shouldBePrimary = !isPrimarySet && node.isActive && index === 0;
      if (shouldBePrimary) isPrimarySet = true;
      return {
        shop_id: shopId,
        shopify_location_id: parseShopifyGid(node.id),
        name: node.name,
        active: node.isActive,
        is_primary: shouldBePrimary,
      };
    });

    if (rows.length > 0) {
      if (rows[0].is_primary) {
        await supabase
          .from("locations")
          .update({ is_primary: false })
          .eq("shop_id", shopId)
          .neq("shopify_location_id", rows[0].shopify_location_id);
      }

      const { data: upserted, error } = await supabase
        .from("locations")
        .upsert(rows, { onConflict: "shop_id,shopify_location_id" })
        .select("id, shopify_location_id");

      if (error) throw error;
      for (const loc of upserted ?? []) {
        locationMap.set(loc.shopify_location_id, loc.id);
      }
      stats.locations += rows.length;
    }

    cursor = data.locations.pageInfo.hasNextPage
      ? data.locations.pageInfo.endCursor
      : null;
  } while (cursor);

  return locationMap;
}

async function syncProduct(
  client: Awaited<ReturnType<typeof getGraphqlClient>>,
  supabase: ReturnType<typeof createAdminClient>,
  shopId: string,
  product: ProductNode,
  locationMap: Map<number, string>,
  stats: SyncStats,
) {
  const shopifyProductId = parseShopifyGid(product.id);

  const { data: productRow, error: productError } = await supabase
    .from("products")
    .upsert(
      {
        shop_id: shopId,
        shopify_product_id: shopifyProductId,
        title: product.title,
        vendor: product.vendor,
        product_type: product.productType,
        status: product.status.toLowerCase(),
        tags: product.tags,
        image_url: product.featuredImage?.url ?? null,
      },
      { onConflict: "shop_id,shopify_product_id" },
    )
    .select("id")
    .single();

  if (productError) throw productError;
  stats.products += 1;

  let variantCursor: string | null = null;
  let variantsPage = product.variants;

  while (true) {
    for (const { node: variant } of variantsPage.edges) {
      const levels = await syncVariant(
        client,
        supabase,
        shopId,
        productRow.id,
        variant,
        locationMap,
      );
      stats.variants += 1;
      stats.inventoryLevels += levels;
    }

    if (!variantsPage.pageInfo.hasNextPage) break;

    variantCursor = variantsPage.pageInfo.endCursor;
    const next: ProductVariantsQueryResult = await shopifyGql(
      client,
      PRODUCT_VARIANTS_QUERY,
      {
        productId: product.id,
        cursor: variantCursor,
      },
    );
    variantsPage = next.product.variants;
  }
}

async function syncVariant(
  client: Awaited<ReturnType<typeof getGraphqlClient>>,
  supabase: ReturnType<typeof createAdminClient>,
  shopId: string,
  productId: string,
  variant: VariantNode,
  locationMap: Map<number, string>,
) {
  const shopifyVariantId = parseShopifyGid(variant.id);
  const inventoryItemId = parseShopifyGid(variant.inventoryItem.id);

  const { data: variantRow, error: variantError } = await supabase
    .from("variants")
    .upsert(
      {
        shop_id: shopId,
        product_id: productId,
        shopify_variant_id: shopifyVariantId,
        shopify_inventory_item_id: inventoryItemId,
        title: variant.title,
        sku: variant.sku,
        barcode: variant.barcode,
        price: variant.price ? Number(variant.price) : null,
        cost: variant.inventoryItem.unitCost?.amount
          ? Number(variant.inventoryItem.unitCost.amount)
          : null,
        tracked: variant.inventoryItem.tracked,
      },
      { onConflict: "shop_id,shopify_variant_id" },
    )
    .select("id")
    .single();

  if (variantError) throw variantError;

  return syncInventoryLevels(
    client,
    supabase,
    shopId,
    variantRow.id,
    variant.inventoryItem.id,
    locationMap,
  );
}

async function syncInventoryLevels(
  client: Awaited<ReturnType<typeof getGraphqlClient>>,
  supabase: ReturnType<typeof createAdminClient>,
  shopId: string,
  variantId: string,
  inventoryItemGid: string,
  locationMap: Map<number, string>,
) {
  let cursor: string | null = null;
  let total = 0;

  do {
    const data: VariantInventoryQueryResult = await shopifyGql(
      client,
      VARIANT_INVENTORY_QUERY,
      { itemId: inventoryItemGid, cursor },
    );

    const rows = data.inventoryItem.inventoryLevels.edges
      .map(({ node }) => {
        const locationId = locationMap.get(parseShopifyGid(node.location.id));
        if (!locationId) return null;
        const available = qtyNamed(node.quantities, "available");
        const onHand = qtyNamed(node.quantities, "on_hand");
        const committed = qtyNamed(node.quantities, "committed");
        return {
          shop_id: shopId,
          variant_id: variantId,
          location_id: locationId,
          available,
          committed,
          on_hand: onHand || available,
          shopify_inventory_level_id: node.id,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rows.length > 0) {
      const { error } = await supabase
        .from("inventory_levels")
        .upsert(rows, { onConflict: "variant_id,location_id" });
      if (error) throw error;
      total += rows.length;
    }

    cursor = data.inventoryItem.inventoryLevels.pageInfo.hasNextPage
      ? data.inventoryItem.inventoryLevels.pageInfo.endCursor
      : null;
  } while (cursor);

  return total;
}
