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

const PRODUCTS_QUERY = `
  query SyncProducts($cursor: String) {
    products(first: 25, after: $cursor) {
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
          variants(first: 100) {
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
      variants(first: 100, after: $cursor) {
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

const VARIANT_INVENTORY_QUERY = `
  query SyncVariantInventory($itemId: ID!, $cursor: String) {
    inventoryItem(id: $itemId) {
      inventoryLevels(first: 50, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id
            available
            location { id }
          }
        }
      }
    }
  }
`;

type VariantInventoryQueryResult = {
  inventoryItem: {
    inventoryLevels: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: {
        node: { id: string; available: number; location: { id: string } };
      }[];
    };
  };
};

export async function runFullCatalogSync(
  shop: string,
  shopId: string,
): Promise<SyncStats> {
  const client = await getGraphqlClient(shop);
  const supabase = createAdminClient();
  const stats: SyncStats = {
    locations: 0,
    products: 0,
    variants: 0,
    inventoryLevels: 0,
    bundleParents: 0,
    bundleComponents: 0,
  };

  const locationMap = await syncLocations(
    client,
    supabase,
    shopId,
    stats,
  );

  let productCursor: string | null = null;

  do {
    const data: ProductsQueryResult = await shopifyGql(
      client,
      PRODUCTS_QUERY,
      { cursor: productCursor },
    );

    for (const { node: product } of data.products.edges) {
      await syncProduct(
        client,
        supabase,
        shopId,
        product,
        locationMap,
        stats,
      );
    }

    productCursor = data.products.pageInfo.hasNextPage
      ? data.products.pageInfo.endCursor
      : null;
  } while (productCursor);

  const bundleStats = await runBundleComponentSync(shop, shopId);
  stats.bundleParents = bundleStats.bundleParents;
  stats.bundleComponents = bundleStats.bundleComponents;

  return stats;
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
        return {
          shop_id: shopId,
          variant_id: variantId,
          location_id: locationId,
          available: node.available,
          committed: 0,
          on_hand: node.available,
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
