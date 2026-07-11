import { createAdminClient } from "@/lib/supabase/admin";
import { syncBundleComponentsForProduct } from "@/lib/sync/bundle-components";
import { syncProductVariantCosts } from "@/lib/sync/variant-costs";

type WebhookVariant = {
  id?: number;
  title?: string;
  sku?: string | null;
  barcode?: string | null;
  price?: string;
  inventory_item_id?: number;
  admin_graphql_api_id?: string;
};

export async function handleProductWebhook(
  shopId: string,
  shop: string,
  payload: Record<string, unknown>,
) {
  const productId = Number(payload.id);
  if (!Number.isFinite(productId)) return { handled: false };

  const supabase = createAdminClient();
  const tags =
    typeof payload.tags === "string"
      ? payload.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

  const image =
    (payload.image as { src?: string } | undefined)?.src ??
    (payload.featured_image as string | undefined) ??
    null;

  const { data: productRow, error: productError } = await supabase
    .from("products")
    .upsert(
      {
        shop_id: shopId,
        shopify_product_id: productId,
        title: String(payload.title ?? "Untitled"),
        vendor: (payload.vendor as string) ?? null,
        product_type: (payload.product_type as string) ?? null,
        status: String(payload.status ?? "active").toLowerCase(),
        tags,
        image_url: image,
      },
      { onConflict: "shop_id,shopify_product_id" },
    )
    .select("id")
    .single();

  if (productError) throw productError;

  const variants = (payload.variants as WebhookVariant[] | undefined) ?? [];
  const variantIds = new Set(variants.filter((v) => v.id).map((v) => v.id!));
  let variantCount = 0;

  for (const variant of variants) {
    if (!variant.id) continue;

    const { error } = await supabase.from("variants").upsert(
      {
        shop_id: shopId,
        product_id: productRow.id,
        shopify_variant_id: variant.id,
        shopify_inventory_item_id: variant.inventory_item_id ?? null,
        title: variant.title ?? "Default",
        sku: variant.sku ?? null,
        barcode: variant.barcode ?? null,
        price: variant.price ? Number(variant.price) : null,
        tracked: Boolean(variant.inventory_item_id),
      },
      { onConflict: "shop_id,shopify_variant_id" },
    );

    if (error) throw error;
    variantCount += 1;
  }

  if (variantIds.size > 0) {
    const { data: existingVariants } = await supabase
      .from("variants")
      .select("id, shopify_variant_id")
      .eq("shop_id", shopId)
      .eq("product_id", productRow.id);

    const toDelete = (existingVariants ?? [])
      .filter((v) => !variantIds.has(v.shopify_variant_id))
      .map((v) => v.id);

    if (toDelete.length > 0) {
      await supabase.from("variants").delete().in("id", toDelete);
    }
  }

  const costsUpdated = await syncProductVariantCosts(shop, shopId, productId);
  const bundleStats = await syncBundleComponentsForProduct(shop, shopId, productId);

  return { handled: true, productId, variantCount, costsUpdated, bundleStats };
}

export async function handleProductDelete(
  shopId: string,
  payload: Record<string, unknown>,
) {
  const productId = Number(payload.id);
  if (!Number.isFinite(productId)) return { handled: false };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("products")
    .delete()
    .eq("shop_id", shopId)
    .eq("shopify_product_id", productId);

  if (error) throw error;
  return { handled: true, productId };
}

export async function handleInventoryLevelWebhook(
  shopId: string,
  payload: Record<string, unknown>,
) {
  const inventoryItemId = Number(payload.inventory_item_id);
  const locationId = Number(payload.location_id);
  const available = Number(payload.available ?? 0);

  if (!Number.isFinite(inventoryItemId) || !Number.isFinite(locationId)) {
    return { handled: false };
  }

  const supabase = createAdminClient();

  const { data: variant, error: variantError } = await supabase
    .from("variants")
    .select("id")
    .eq("shop_id", shopId)
    .eq("shopify_inventory_item_id", inventoryItemId)
    .maybeSingle();

  if (variantError) throw variantError;
  if (!variant) return { handled: false, reason: "variant_not_synced" };

  const { data: location, error: locationError } = await supabase
    .from("locations")
    .select("id")
    .eq("shop_id", shopId)
    .eq("shopify_location_id", locationId)
    .maybeSingle();

  if (locationError) throw locationError;
  if (!location) return { handled: false, reason: "location_not_synced" };

  const adminGraphqlId = payload.admin_graphql_api_id as string | undefined;

  const { error } = await supabase.from("inventory_levels").upsert(
    {
      shop_id: shopId,
      variant_id: variant.id,
      location_id: location.id,
      available,
      committed: 0,
      on_hand: available,
      shopify_inventory_level_id: adminGraphqlId ?? null,
    },
    { onConflict: "variant_id,location_id" },
  );

  if (error) throw error;
  return { handled: true };
}

export function normalizeWebhookTopic(topic: string) {
  return topic.toLowerCase().replace(/\//g, "_");
}

export async function applyWebhook(
  shopId: string,
  shop: string,
  topic: string,
  payload: Record<string, unknown>,
) {
  const normalized = normalizeWebhookTopic(topic);

  switch (normalized) {
    case "products_create":
    case "products_update":
      return handleProductWebhook(shopId, shop, payload);
    case "products_delete":
      return handleProductDelete(shopId, payload);
    case "inventory_levels_update":
      return handleInventoryLevelWebhook(shopId, payload);
    case "app_subscriptions_update":
      return { handled: true, topic: normalized, subscriptionUpdate: true };
    default:
      return { handled: false, topic: normalized };
  }
}
