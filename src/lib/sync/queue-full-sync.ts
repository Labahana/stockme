import { createAdminClient } from "@/lib/supabase/admin";
import { inngest } from "@/lib/inngest/client";
import { runChunkedSyncStep, type ChunkedSyncStatus } from "@/lib/sync/chunked-sync";
import { assertSkuLimit } from "@/lib/billing/limits";

export type QueueFullSyncResult = {
  mode: "queued" | "chunked" | "inline";
  hasMore?: boolean;
  sync?: ChunkedSyncStatus;
  stats?: {
    locations: number;
    products: number;
    variants: number;
    inventoryLevels: number;
  };
  message: string;
};

function hasInngestEventKey() {
  return Boolean(process.env.INNGEST_EVENT_KEY?.trim());
}

/**
 * Interactive force sync always runs chunked steps inline so the Admin UI gets
 * real progress/errors (App Store reviewers click Sync and must see products).
 * Background/non-force jobs may queue to Inngest when configured.
 */
export async function queueOrRunFullSync(
  shop: string,
  shopId: string,
  force = true,
): Promise<QueueFullSyncResult> {
  if (!force && hasInngestEventKey()) {
    await inngest.send({
      name: "shopify/sync.full",
      data: { shop, force },
    });
    return {
      mode: "queued",
      message: "Sync queued. Inventory will update shortly.",
    };
  }

  const supabase = createAdminClient();
  const { data: syncRun } = await supabase
    .from("sync_runs")
    .insert({
      shop_id: shopId,
      sync_type: force ? "force" : "full",
      status: "running",
    })
    .select("id")
    .single();

  // Keep calling chunk steps in this request while under ~7s, then return
  // hasMore so the client can continue without hitting the hard timeout.
  const deadline = Date.now() + 7_000;
  let status = await runChunkedSyncStep(shop, shopId, { restart: true });
  while (status.hasMore && Date.now() < deadline) {
    status = await runChunkedSyncStep(shop, shopId);
  }

  if (syncRun?.id) {
    const skuWarning = await (async () => {
      const { data: store } = await supabase.from("stores").select("*").eq("id", shopId).single();
      return store ? assertSkuLimit(store) : null;
    })();

    await supabase
      .from("sync_runs")
      .update({
        status: status.phase === "error" || skuWarning ? "failed" : status.hasMore ? "running" : "completed",
        completed_at: status.hasMore ? null : new Date().toISOString(),
        items_processed:
          status.productsSynced + status.variantsSynced + status.inventorySynced,
        error_message: skuWarning ?? status.error ?? null,
      })
      .eq("id", syncRun.id);
  }

  if (status.phase === "error") {
    throw new Error(status.error ?? status.message);
  }

  return {
    mode: "chunked",
    hasMore: status.hasMore,
    sync: status,
    stats: {
      locations: status.locationsSynced,
      products: status.productsSynced,
      variants: status.variantsSynced,
      inventoryLevels: status.inventorySynced,
    },
    message: status.hasMore
      ? `${status.message} Continuing…`
      : status.message,
  };
}

export async function continueChunkedSync(shop: string, shopId: string) {
  const status = await runChunkedSyncStep(shop, shopId);
  if (status.phase === "error") {
    throw new Error(status.error ?? status.message);
  }
  return status;
}
