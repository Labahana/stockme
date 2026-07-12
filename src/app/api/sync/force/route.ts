import { NextRequest, NextResponse } from "next/server";
import { loadOfflineSession, sanitizeShop } from "@/lib/shopify";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSkuLimit } from "@/lib/billing/limits";
import { queueOrRunFullSync } from "@/lib/sync/queue-full-sync";
// import { billingBypassEnabled } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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

  try {
    const result = await queueOrRunFullSync(shop, store.id, true);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    console.error("Force sync failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
