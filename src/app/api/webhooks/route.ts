import { inngest } from "@/lib/inngest/client";
import { loadOfflineSession, shopify } from "@/lib/shopify";
import { createAdminClient } from "@/lib/supabase/admin";
import { redactShopData } from "@/lib/shopify/gdpr";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const GDPR_TOPICS = new Set([
  "customers/data_request",
  "customers/redact",
  "shop/redact",
]);

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const topic = request.headers.get("x-shopify-topic") ?? "";
  const shop = request.headers.get("x-shopify-shop-domain") ?? "";
  const webhookId = request.headers.get("x-shopify-webhook-id") ?? undefined;

  let payload: Record<string, unknown> = {};
  try {
    payload = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let validation: { valid: boolean };
  try {
    validation = await shopify.webhooks.validate({
      rawBody,
      rawRequest: request,
    });
  } catch (err) {
    console.error("Webhook validation error:", err);
    // App Store automated checks expect 400 (not 401) on invalid HMAC.
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }

  if (!validation.valid) {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 400 });
  }

  if (topic === "shop/redact") {
    if (shop) await redactShopData(shop);
    return NextResponse.json({ ok: true });
  }

  if (topic === "customers/data_request" || topic === "customers/redact") {
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminClient();

  if (topic === "app/uninstalled") {
    await supabase.from("shopify_sessions").delete().eq("shop", shop);
    await supabase
      .from("stores")
      .update({ billing_status: "cancelled" })
      .eq("shop_domain", shop);
    return NextResponse.json({ ok: true });
  }

  const session = await loadOfflineSession(shop);
  if (!session && !GDPR_TOPICS.has(topic)) {
    return NextResponse.json({ error: "Unknown shop" }, { status: 401 });
  }

  // Free-tier: metadata-only log (no payload body in Postgres)
  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("shop_domain", shop)
    .maybeSingle();

  if (store?.id && webhookId) {
    await supabase.from("webhook_logs").upsert(
      {
        shop_id: store.id,
        topic: topic.slice(0, 80),
        webhook_id: webhookId.slice(0, 80),
        status: 1,
      },
      { onConflict: "shop_id,webhook_id", ignoreDuplicates: true },
    );
  }

  try {
    if (process.env.INNGEST_EVENT_KEY?.trim()) {
      await inngest.send({
        name: "shopify/webhook.received",
        data: {
          shop,
          topic,
          payload,
          webhookId,
        },
      });
      if (store?.id && webhookId) {
        await supabase
          .from("webhook_logs")
          .update({ status: 2, processed_at: new Date().toISOString() })
          .eq("shop_id", store.id)
          .eq("webhook_id", webhookId);
      }
    } else {
      // No Inngest: apply webhook inline via handler (payload stays in memory only)
      const { applyWebhook } = await import("@/lib/sync/webhook-handlers");
      if (store?.id) {
        await applyWebhook(store.id, shop, topic, payload);
        if (webhookId) {
          await supabase
            .from("webhook_logs")
            .update({ status: 2, processed_at: new Date().toISOString() })
            .eq("shop_id", store.id)
            .eq("webhook_id", webhookId);
        }
      }
    }
  } catch (err) {
    console.error("Webhook processing failed:", err);
    if (store?.id && webhookId) {
      await supabase
        .from("webhook_logs")
        .update({
          status: 3,
          error_message: (err instanceof Error ? err.message : "error").slice(0, 255),
          processed_at: new Date().toISOString(),
        })
        .eq("shop_id", store.id)
        .eq("webhook_id", webhookId);
    }
  }

  return NextResponse.json({ ok: true });
}
