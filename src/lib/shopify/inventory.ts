import { getGraphqlClient } from "@/lib/shopify";
import { shopifyGql } from "@/lib/shopify/graphql";
import { shopifyGid } from "@/lib/shopify/gid";

const ADJUST_MUTATION = `
  mutation AdjustInventory($input: InventoryAdjustQuantitiesInput!) {
    inventoryAdjustQuantities(input: $input) {
      userErrors { field message }
    }
  }
`;

const SET_BARCODE_MUTATION = `
  mutation SetBarcode($input: ProductVariantInput!) {
    productVariantUpdate(input: $input) {
      productVariant { id barcode }
      userErrors { field message }
    }
  }
`;

export async function adjustShopifyInventory(
  shop: string,
  inventoryItemGid: string,
  locationGid: string,
  delta: number,
  reason = "correction",
) {
  const client = await getGraphqlClient(shop);
  const data = await shopifyGql<{
    inventoryAdjustQuantities: {
      userErrors: { field: string[]; message: string }[];
    };
  }>(client, ADJUST_MUTATION, {
    input: {
      reason,
      name: "available",
      changes: [
        {
          inventoryItemId: inventoryItemGid,
          locationId: locationGid,
          delta,
        },
      ],
    },
  });

  const errors = data.inventoryAdjustQuantities.userErrors;
  if (errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join("; "));
  }
}

export async function setVariantBarcode(
  shop: string,
  shopifyVariantId: number,
  barcode: string,
) {
  const client = await getGraphqlClient(shop);
  const data = await shopifyGql<{
    productVariantUpdate: {
      userErrors: { message: string }[];
    };
  }>(client, SET_BARCODE_MUTATION, {
    input: {
      id: shopifyGid("ProductVariant", shopifyVariantId),
      barcode,
    },
  });

  const errors = data.productVariantUpdate.userErrors;
  if (errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join("; "));
  }
}

export function locationGid(shopifyLocationId: number) {
  return shopifyGid("Location", shopifyLocationId);
}

export function inventoryItemGid(shopifyInventoryItemId: number) {
  return shopifyGid("InventoryItem", shopifyInventoryItemId);
}
