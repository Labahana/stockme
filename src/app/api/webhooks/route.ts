import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { loadOfflineSession, shopify } from "@/lib/shopify";
import { createAdminClient } from "@/lib/supabase/admin";
import { redactShopData } from "@/lib/shopify/gdpr";

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
    return NextResponse.json({ error: "Invalid webhook" }, { status: 401 });
  }

  if (!validation.valid) {
    return NextResponse.json({ error: "Invalid webhook" }, { status: 401 });
  }

  // GDPR compliance webhooks must succeed even after uninstall (no session).
  if (topic === "shop/redact") {
    if (shop) await redactShopData(shop);
    return NextResponse.json({ ok: true });
  }

  if (topic === "customers/data_request" || topic === "customers/redact") {
    // Stockme stores inventory/PO data only — no customer PII persisted.
    return NextResponse.json({ ok: true });
  }

  if (topic === "app/uninstalled") {
    const supabase = createAdminClient();
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

  await inngest.send({
    name: "shopify/webhook.received",
    data: {
      shop,
      topic,
      payload,
      webhookId,
    },
  });

  return NextResponse.json({ ok: true });
}
