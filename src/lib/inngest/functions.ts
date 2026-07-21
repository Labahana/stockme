import { inngest } from "@/lib/inngest/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { runFullCatalogSync } from "@/lib/sync/full-sync";
import { applyWebhook } from "@/lib/sync/webhook-handlers";
import { sendAllLowStockDigests } from "@/lib/email/low-stock";
import { assertSkuLimit } from "@/lib/billing/limits";
import { billingBypassEnabled, syncStoreBilling } from "@/lib/billing/plans";
import { loadOfflineSession } from "@/lib/shopify";

async function markSyncComplete(
  shopId: string,
  syncRunId: string,
  itemsProcessed: number,
  error?: string,
) {
  const supabase = createAdminClient();
  await supabase
    .from("sync_runs")
    .update({
      status: error ? "failed" : "completed",
      completed_at: new Date().toISOString(),
      items_processed: itemsProcessed,
      error_message: error ?? null,
    })
    .eq("id", syncRunId);

  if (!error) {
    await supabase
      .from("stores")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", shopId);
  }
}

export const processWebhook = inngest.createFunction(
  {
    id: "process-shopify-webhook",
    retries: 3,
    triggers: [{ event: "shopify/webhook.received" }],
  },
  async ({ event, step }) => {
    const { shop, topic, payload } = event.data as {
      shop: string;
      topic: string;
      payload: Record<string, unknown>;
    };
    const supabase = createAdminClient();

    const store = await step.run("load-store", async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("id")
        .eq("shop_domain", shop)
        .single();
      if (error) throw error;
      return data;
    });

    const syncRun = await step.run("create-sync-run", async () => {
      const { data, error } = await supabase
        .from("sync_runs")
        .insert({
          shop_id: store.id,
          sync_type: "webhook",
          status: "running",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    });

    try {
      const result = await step.run("apply-webhook", async () => {
        const normalized = topic.toLowerCase().replace(/\//g, "_");
        if (normalized === "app_subscriptions_update") {
          const offlineSession = await loadOfflineSession(shop);
          if (offlineSession) {
            return syncStoreBilling(offlineSession, store.id);
          }
          return { handled: true, subscriptionUpdate: true };
        }
        return applyWebhook(store.id, shop, topic, payload);
      });

      await step.run("complete-sync", async () => {
        await markSyncComplete(store.id, syncRun.id, 1);
      });

      return { ok: true, topic, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await markSyncComplete(store.id, syncRun.id, 0, message);
      throw err;
    }
  },
);

export const runFullSync = inngest.createFunction(
  {
    id: "run-full-sync",
    retries: 2,
    triggers: [{ event: "shopify/sync.full" }],
  },
  async ({ event, step }) => {
    const { shop, force } = event.data as { shop: string; force?: boolean };
    const supabase = createAdminClient();

    const store = await step.run("load-store", async () => {
      const { data, error } = await supabase
        .from("stores")
        .select("*")
        .eq("shop_domain", shop)
        .single();
      if (error) throw error;
      return data;
    });

    // Force syncs (install / manual) should still run even if the subscription
    // webhook hasn't flipped billing_status yet — App Store review depends on it.
    if (!force && store.billing_status !== "active" && !billingBypassEnabled()) {
      await step.run("skip-unbilled", async () => {
        await supabase.from("sync_runs").insert({
          shop_id: store.id,
          sync_type: force ? "force" : "full",
          status: "failed",
          error_message: "Skipped: no active subscription",
        });
      });
      return { ok: false, skipped: "no_active_subscription" };
    }

    const syncRun = await step.run("create-sync-run", async () => {
      const { data, error } = await supabase
        .from("sync_runs")
        .insert({
          shop_id: store.id,
          sync_type: force ? "force" : "full",
          status: "running",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    });

    try {
      const stats = await step.run("sync-catalog", async () =>
        runFullCatalogSync(shop, store.id),
      );

      const skuWarning = await step.run("check-sku-limit", async () => {
        const { data } = await supabase
          .from("stores")
          .select("*")
          .eq("id", store.id)
          .single();
        if (!data) return null;
        return assertSkuLimit(data);
      });

      await step.run("complete-sync", async () => {
        const total =
          stats.products +
          stats.variants +
          stats.inventoryLevels +
          stats.locations +
          stats.bundleComponents;
        await markSyncComplete(
          store.id,
          syncRun.id,
          total,
          skuWarning ?? undefined,
        );
      });

      return { ok: !skuWarning, stats, skuWarning };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      await markSyncComplete(store.id, syncRun.id, 0, message);
      throw err;
    }
  },
);

export const lowStockDigest = inngest.createFunction(
  {
    id: "daily-low-stock-digest",
    triggers: [{ cron: "0 13 * * *" }],
  },
  async () => {
    const results = await sendAllLowStockDigests();
    return { sent: results.filter((r) => r.sent).length, results };
  },
);

export const inngestFunctions = [processWebhook, runFullSync, lowStockDigest];
