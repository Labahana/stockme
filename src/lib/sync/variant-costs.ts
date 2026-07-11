import { getGraphqlClient } from "@/lib/shopify";
import { shopifyGql } from "@/lib/shopify/graphql";
import { parseShopifyGid } from "@/lib/shopify/gid";
import { createAdminClient } from "@/lib/supabase/admin";

const PRODUCT_COSTS_QUERY = `
  query ProductVariantCosts($id: ID!, $cursor: String) {
    product(id: $id) {
      variants(first: 100, after: $cursor) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id
            inventoryItem {
              unitCost { amount }
            }
          }
        }
      }
    }
  }
`;

type CostsResult = {
  product: {
    variants: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      edges: { node: { id: string; inventoryItem: { unitCost: { amount: string } | null } } }[];
    };
  } | null;
};

export async function syncProductVariantCosts(
  shop: string,
  shopId: string,
  shopifyProductId: number,
) {
  const client = await getGraphqlClient(shop);
  const supabase = createAdminClient();
  const productGid = `gid://shopify/Product/${shopifyProductId}`;
  let cursor: string | null = null;
  let updated = 0;

  do {
    const data: CostsResult = await shopifyGql(client, PRODUCT_COSTS_QUERY, {
      id: productGid,
      cursor,
    });

    if (!data.product) break;

    for (const { node } of data.product.variants.edges) {
      const cost = node.inventoryItem.unitCost?.amount
        ? Number(node.inventoryItem.unitCost.amount)
        : null;
      const shopifyVariantId = parseShopifyGid(node.id);

      const { error } = await supabase
        .from("variants")
        .update({ cost })
        .eq("shop_id", shopId)
        .eq("shopify_variant_id", shopifyVariantId);

      if (!error) updated += 1;
    }

    cursor = data.product.variants.pageInfo.hasNextPage
      ? data.product.variants.pageInfo.endCursor
      : null;
  } while (cursor);

  return updated;
}
