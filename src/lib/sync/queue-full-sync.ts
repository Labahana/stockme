import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { runFullCatalogSync } from "@/lib/sync/full-sync";
import { assertSkuLimit } from "@/lib/billing/limits";

export type QueueFullSyncResult = {
  mode: "queued" | "inline";
  stats?: {
    locations: number;
    products: number;
    variants: number;
    inventoryLevels: number;
    bundleParents: number;
    bundleComponents: number;
  };
  message: string;
};

function hasInngestEventKey() {
  return Boolean(process.env.INNGEST_EVENT_KEY?.trim());
}

async function runInlineFullSync(shop: string, shopId: string, force: boolean) {
  const supabase = createAdminClient();
  const { data: syncRun, error: runError } = await supabase
    .from("sync_runs")
    .insert({
      shop_id: shopId,
      sync_type: force ? "force" : "full",
      status: "running",
    })
    .select("id")
    .single();

  if (runError || !syncRun) {
    throw new Error(runError?.message ?? "Failed to create sync run");
  }

  try {
    const stats = await runFullCatalogSync(shop, shopId);
    const { data: store } = await supabase
      .from("stores")
      .select("*")
      .eq("id", shopId)
      .single();

    const skuWarning = store ? await assertSkuLimit(store) : null;
    const total =
      stats.products +
      stats.variants +
      stats.inventoryLevels +
      stats.locations +
      stats.bundleComponents;

    await supabase
      .from("sync_runs")
      .update({
        status: skuWarning ? "failed" : "completed",
        completed_at: new Date().toISOString(),
        items_processed: total,
        error_message: skuWarning,
      })
      .eq("id", syncRun.id);

    if (!skuWarning) {
      await supabase
        .from("stores")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", shopId);
    }

    if (skuWarning) {
      throw new Error(skuWarning);
    }

    return stats;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await supabase
      .from("sync_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        items_processed: 0,
        error_message: message,
      })
      .eq("id", syncRun.id);
    throw err;
  }
}

/**
 * Prefer Inngest when configured. Otherwise run catalog sync inline so
 * force-sync works without INNGEST_EVENT_KEY (common on early deploys).
 */
export async function queueOrRunFullSync(
  shop: string,
  shopId: string,
  force = true,
): Promise<QueueFullSyncResult> {
  if (hasInngestEventKey()) {
    await inngest.send({
      name: "shopify/sync.full",
      data: { shop, force },
    });
    return {
      mode: "queued",
      message: "Sync queued. Inventory will update shortly.",
    };
  }

  const stats = await runInlineFullSync(shop, shopId, force);
  return {
    mode: "inline",
    stats,
    message: `Synced ${stats.products} products, ${stats.variants} variants across ${stats.locations} locations.`,
  };
}
