import { createAdminClient } from "@/lib/supabase/admin";
import { getGraphqlClient } from "@/lib/shopify";
import { shopifyGql } from "@/lib/shopify/graphql";
import { parseShopifyGid } from "@/lib/shopify/gid";

export type BundleSyncStats = {
  bundleParents: number;
  bundleComponents: number;
};

type ComponentInput = {
  childShopifyVariantId: number;
  quantity: number;
};

type BundleVariantNode = {
  id: string;
  requiresComponents: boolean;
  productVariantComponents: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: { quantity: number; productVariant: { id: string } }[];
  };
};

type BundleProductNode = {
  id: string;
  hasVariantsThatRequiresComponents: boolean;
  bundleComponents: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: {
      quantity: number;
      componentProduct: {
        id: string;
        variants: { nodes: { id: string }[] };
      };
    }[];
  };
  variants: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: { node: BundleVariantNode }[];
  };
};

type BundleProductsQueryResult = {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    edges: { node: BundleProductNode }[];
  };
};

const BUNDLE_PRODUCTS_QUERY = `
  query SyncBundleProducts($cursor: String) {
    products(first: 25, after: $cursor, query: "has_variant_with_components:true") {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          hasVariantsThatRequiresComponents
          bundleComponents(first: 250) {
            pageInfo { hasNextPage endCursor }
            nodes {
              quantity
              componentProduct {
                id
                variants(first: 250) {
                  nodes { id }
                }
              }
            }
          }
          variants(first: 250) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                id
                requiresComponents
                productVariantComponents(first: 250) {
                  pageInfo { hasNextPage endCursor }
                  nodes {
                    quantity
                    productVariant { id }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const SINGLE_PRODUCT_BUNDLE_QUERY = `
  query SyncProductBundles($id: ID!) {
    product(id: $id) {
      id
      hasVariantsThatRequiresComponents
      bundleComponents(first: 250) {
        pageInfo { hasNextPage endCursor }
        nodes {
          quantity
          componentProduct {
            id
            variants(first: 250) {
              nodes { id }
            }
          }
        }
      }
      variants(first: 250) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id
            requiresComponents
            productVariantComponents(first: 250) {
              pageInfo { hasNextPage endCursor }
              nodes {
                quantity
                productVariant { id }
              }
            }
          }
        }
      }
    }
  }
`;

function productFixedComponents(
  product: BundleProductNode,
): ComponentInput[] {
  const components: ComponentInput[] = [];

  for (const node of product.bundleComponents?.nodes ?? []) {
    const childVariant = node.componentProduct?.variants?.nodes?.[0];
    if (!childVariant) continue;
    components.push({
      childShopifyVariantId: parseShopifyGid(childVariant.id),
      quantity: Number(node.quantity) || 1,
    });
  }

  return components;
}

function variantFixedComponents(variant: BundleVariantNode): ComponentInput[] {
  return (variant.productVariantComponents?.nodes ?? []).map((node) => ({
    childShopifyVariantId: parseShopifyGid(node.productVariant.id),
    quantity: Number(node.quantity) || 1,
  }));
}

async function resolveVariantIds(
  supabase: ReturnType<typeof createAdminClient>,
  shopId: string,
  shopifyVariantIds: number[],
) {
  if (shopifyVariantIds.length === 0) return new Map<number, string>();

  const { data, error } = await supabase
    .from("variants")
    .select("id, shopify_variant_id")
    .eq("shop_id", shopId)
    .in("shopify_variant_id", shopifyVariantIds);

  if (error) throw error;

  return new Map(
    (data ?? []).map((row) => [row.shopify_variant_id, row.id] as const),
  );
}

async function persistBundleComponents(
  supabase: ReturnType<typeof createAdminClient>,
  shopId: string,
  parentVariantId: string,
  components: ComponentInput[],
  variantIdMap: Map<number, string>,
) {
  const rows = components
    .map((component) => {
      const childVariantId = variantIdMap.get(component.childShopifyVariantId);
      if (!childVariantId) return null;
      return {
        shop_id: shopId,
        parent_variant_id: parentVariantId,
        child_variant_id: childVariantId,
        quantity: component.quantity,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const { data: existing, error: existingError } = await supabase
    .from("bundle_components")
    .select("id, child_variant_id")
    .eq("shop_id", shopId)
    .eq("parent_variant_id", parentVariantId);

  if (existingError) throw existingError;

  const nextChildIds = new Set(rows.map((row) => row.child_variant_id));
  const staleIds = (existing ?? [])
    .filter((row) => !nextChildIds.has(row.child_variant_id))
    .map((row) => row.id);

  if (staleIds.length > 0) {
    const { error } = await supabase.from("bundle_components").delete().in("id", staleIds);
    if (error) throw error;
  }

  if (rows.length === 0) {
    if ((existing ?? []).length > 0) {
      const { error } = await supabase
        .from("bundle_components")
        .delete()
        .eq("shop_id", shopId)
        .eq("parent_variant_id", parentVariantId);
      if (error) throw error;
    }
    return 0;
  }

  const { error } = await supabase
    .from("bundle_components")
    .upsert(rows, { onConflict: "parent_variant_id,child_variant_id" });

  if (error) throw error;
  return rows.length;
}

async function syncBundleProduct(
  supabase: ReturnType<typeof createAdminClient>,
  shopId: string,
  product: BundleProductNode,
  stats: BundleSyncStats,
) {
  const shopifyProductId = parseShopifyGid(product.id);
  const productFixed = productFixedComponents(product);
  const isBundle =
    product.hasVariantsThatRequiresComponents ||
    product.variants.edges.some(({ node }) => node.requiresComponents);

  const { data: productRow, error: productError } = await supabase
    .from("products")
    .update({ is_bundle: isBundle })
    .eq("shop_id", shopId)
    .eq("shopify_product_id", shopifyProductId)
    .select("id")
    .maybeSingle();

  if (productError) throw productError;
  if (!productRow) return;

  const parentShopifyIds = product.variants.edges.map(({ node }) =>
    parseShopifyGid(node.id),
  );
  const childShopifyIds = new Set<number>();

  for (const { node } of product.variants.edges) {
    const components = node.requiresComponents
      ? variantFixedComponents(node)
      : productFixed;
    for (const component of components) {
      childShopifyIds.add(component.childShopifyVariantId);
    }
  }

  const parentMap = await resolveVariantIds(supabase, shopId, parentShopifyIds);
  const childMap = await resolveVariantIds(
    supabase,
    shopId,
    Array.from(childShopifyIds),
  );
  const variantIdMap = new Map<number, string>();
  parentMap.forEach((value, key) => variantIdMap.set(key, value));
  childMap.forEach((value, key) => variantIdMap.set(key, value));

  for (const { node } of product.variants.edges) {
    const parentVariantId = parentMap.get(parseShopifyGid(node.id));
    if (!parentVariantId) continue;

    const components = node.requiresComponents
      ? variantFixedComponents(node)
      : productFixed;

    if (components.length === 0) {
      await persistBundleComponents(supabase, shopId, parentVariantId, [], variantIdMap);
      continue;
    }

    const count = await persistBundleComponents(
      supabase,
      shopId,
      parentVariantId,
      components,
      variantIdMap,
    );

    if (count > 0) {
      stats.bundleParents += 1;
      stats.bundleComponents += count;
    }
  }
}

export async function runBundleComponentSync(
  shop: string,
  shopId: string,
): Promise<BundleSyncStats> {
  const client = await getGraphqlClient(shop);
  const supabase = createAdminClient();
  const stats: BundleSyncStats = { bundleParents: 0, bundleComponents: 0 };

  let cursor: string | null = null;

  do {
    const data: BundleProductsQueryResult = await shopifyGql(
      client,
      BUNDLE_PRODUCTS_QUERY,
      { cursor },
    );

    for (const { node } of data.products.edges) {
      await syncBundleProduct(supabase, shopId, node, stats);
    }

    cursor = data.products.pageInfo.hasNextPage
      ? data.products.pageInfo.endCursor
      : null;
  } while (cursor);

  return stats;
}

export async function syncBundleComponentsForProduct(
  shop: string,
  shopId: string,
  shopifyProductId: number,
): Promise<BundleSyncStats> {
  const client = await getGraphqlClient(shop);
  const supabase = createAdminClient();
  const stats: BundleSyncStats = { bundleParents: 0, bundleComponents: 0 };

  const data = await shopifyGql<{ product: BundleProductNode | null }>(
    client,
    SINGLE_PRODUCT_BUNDLE_QUERY,
    { id: `gid://shopify/Product/${shopifyProductId}` },
  );

  if (!data.product) {
    await supabase
      .from("products")
      .update({ is_bundle: false })
      .eq("shop_id", shopId)
      .eq("shopify_product_id", shopifyProductId);
    return stats;
  }

  await syncBundleProduct(supabase, shopId, data.product, stats);
  return stats;
}

export async function getBundleChildVariantIds(shopId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("bundle_components")
    .select("child_variant_id")
    .eq("shop_id", shopId);

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.child_variant_id));
}
