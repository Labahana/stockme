import { createAdminClient } from "@/lib/supabase/admin";
import {
  runCatalogSyncStep,
  type CatalogSyncStepInput,
} from "@/lib/sync/full-sync";

export type ChunkedSyncStatus = {
  phase: string;
  productsSynced: number;
  variantsSynced: number;
  inventorySynced: number;
  locationsSynced: number;
  hasMore: boolean;
  error?: string | null;
  message: string;
};

/**
 * Process one sync step under Vercel Hobby's ~10s wall.
 * Client should poll continue until hasMore === false.
 */
export async function runChunkedSyncStep(
  shop: string,
  shopId: string,
  opts: { restart?: boolean } = {},
): Promise<ChunkedSyncStatus> {
  const supabase = createAdminClient();

  if (opts.restart) {
    await supabase.from("sync_state").upsert({
      shop_id: shopId,
      phase: "locations",
      product_cursor: null,
      products_synced: 0,
      variants_synced: 0,
      inventory_synced: 0,
      locations_synced: 0,
      error_message: null,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  let { data: state } = await supabase
    .from("sync_state")
    .select("*")
    .eq("shop_id", shopId)
    .maybeSingle();

  if (!state || state.phase === "idle" || state.phase === "completed") {
    await supabase.from("sync_state").upsert({
      shop_id: shopId,
      phase: "locations",
      product_cursor: null,
      products_synced: 0,
      variants_synced: 0,
      inventory_synced: 0,
      locations_synced: 0,
      error_message: null,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const refreshed = await supabase
      .from("sync_state")
      .select("*")
      .eq("shop_id", shopId)
      .single();
    state = refreshed.data;
  }

  if (!state) {
    return {
      phase: "error",
      productsSynced: 0,
      variantsSynced: 0,
      inventorySynced: 0,
      locationsSynced: 0,
      hasMore: false,
      error: "Could not create sync state",
      message: "Could not create sync state",
    };
  }

  if (state.phase === "error") {
    // Allow retry from products cursor if present, else restart locations
    await supabase
      .from("sync_state")
      .update({
        phase: state.product_cursor ? "products" : "locations",
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("shop_id", shopId);
    state.phase = state.product_cursor ? "products" : "locations";
  }

  const phase = state.phase as CatalogSyncStepInput["phase"];
  if (phase !== "locations" && phase !== "products" && phase !== "bundles") {
    return statusFromRow(state, false, "Idle");
  }

  try {
    const result = await runCatalogSyncStep(shop, shopId, {
      phase,
      cursor: state.product_cursor,
    });

    const productsSynced = state.products_synced + result.pageProducts;
    const variantsSynced = state.variants_synced + result.pageVariants;
    const inventorySynced = state.inventory_synced + result.pageInventory;
    const locationsSynced = state.locations_synced + result.pageLocations;

    const completed = result.nextPhase === "completed";
    await supabase
      .from("sync_state")
      .update({
        phase: completed ? "completed" : result.nextPhase,
        product_cursor: result.nextCursor,
        products_synced: productsSynced,
        variants_synced: variantsSynced,
        inventory_synced: inventorySynced,
        locations_synced: locationsSynced,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("shop_id", shopId);

    if (completed) {
      await supabase
        .from("stores")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", shopId);
    }

    return {
      phase: completed ? "completed" : result.nextPhase,
      productsSynced,
      variantsSynced,
      inventorySynced,
      locationsSynced,
      hasMore: !completed,
      message: completed
        ? `Synced ${productsSynced} products, ${variantsSynced} variants.`
        : `Synced chunk — ${productsSynced} products so far (${result.nextPhase})`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    await supabase
      .from("sync_state")
      .update({
        phase: "error",
        error_message: message.slice(0, 500),
        updated_at: new Date().toISOString(),
      })
      .eq("shop_id", shopId);

    return {
      phase: "error",
      productsSynced: state.products_synced,
      variantsSynced: state.variants_synced,
      inventorySynced: state.inventory_synced,
      locationsSynced: state.locations_synced,
      hasMore: false,
      error: message,
      message,
    };
  }
}

export async function getChunkedSyncStatus(shopId: string): Promise<ChunkedSyncStatus> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("sync_state")
    .select("*")
    .eq("shop_id", shopId)
    .maybeSingle();

  if (!data) {
    return {
      phase: "idle",
      productsSynced: 0,
      variantsSynced: 0,
      inventorySynced: 0,
      locationsSynced: 0,
      hasMore: false,
      message: "No sync in progress",
    };
  }

  return statusFromRow(data, !["idle", "completed", "error"].includes(data.phase));
}

function statusFromRow(
  data: {
    phase: string;
    products_synced: number;
    variants_synced: number;
    inventory_synced: number;
    locations_synced: number;
    error_message: string | null;
  },
  hasMore: boolean,
  messageOverride?: string,
): ChunkedSyncStatus {
  return {
    phase: data.phase,
    productsSynced: data.products_synced,
    variantsSynced: data.variants_synced,
    inventorySynced: data.inventory_synced,
    locationsSynced: data.locations_synced,
    hasMore,
    error: data.error_message,
    message:
      messageOverride ??
      (data.phase === "completed"
        ? `Synced ${data.products_synced} products`
        : `Phase: ${data.phase}`),
  };
}
