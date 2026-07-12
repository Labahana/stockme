import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { loadOfflineSession, sanitizeShop } from "@/lib/shopify";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSkuLimit } from "@/lib/billing/limits";
// import { billingBypassEnabled } from "@/lib/billing/plans";

export async function POST(request: NextRequest) {
  const shop = sanitizeShop(request.nextUrl.searchParams.get("shop"));
  if (!shop) {
    return NextResponse.json({ error: "Invalid shop" }, { status: 400 });
  }

  const session = await loadOfflineSession(shop);
  if (!session) {
    return NextResponse.json({ error: "Not installed" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: store, error } = await supabase
    .from("stores")
    .select("*")
    .eq("shop_domain", shop)
    .single();

  if (error || !store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  // Billing enforcement disabled for initial dev/testing.
  // if (store.billing_status !== "active" && !billingBypassEnabled()) {
  //   return NextResponse.json(
  //     {
  //       error: "An active Shopify subscription is required. Choose a plan in Settings.",
  //       code: "BILLING_REQUIRED",
  //     },
  //     { status: 402 },
  //   );
  // }

  const skuBlocked = await assertSkuLimit(store);
  if (skuBlocked) {
    return NextResponse.json({ error: skuBlocked }, { status: 403 });
  }

  await inngest.send({
    name: "shopify/sync.full",
    data: { shop, force: true },
  });

  return NextResponse.json({ ok: true, message: "Force sync queued" });
}
