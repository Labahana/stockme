import { NextRequest, NextResponse } from "next/server";
import { loadOfflineSession, sanitizeShop } from "@/lib/shopify";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertSkuLimit } from "@/lib/billing/limits";
import { continueChunkedSync, queueOrRunFullSync } from "@/lib/sync/queue-full-sync";
import { getChunkedSyncStatus } from "@/lib/sync/chunked-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  const skuBlocked = await assertSkuLimit(store);
  if (skuBlocked) {
    return NextResponse.json({ error: skuBlocked }, { status: 403 });
  }

  const continueOnly = request.nextUrl.searchParams.get("continue") === "1";

  try {
    if (continueOnly) {
      const sync = await continueChunkedSync(shop, store.id);
      return NextResponse.json({
        ok: true,
        mode: "chunked",
        hasMore: sync.hasMore,
        sync,
        message: sync.message,
      });
    }

    const result = await queueOrRunFullSync(shop, store.id, true);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    console.error("Force sync failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const shop = sanitizeShop(request.nextUrl.searchParams.get("shop"));
  if (!shop) {
    return NextResponse.json({ error: "Invalid shop" }, { status: 400 });
  }

  const session = await loadOfflineSession(shop);
  if (!session) {
    return NextResponse.json({ error: "Not installed" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("shop_domain", shop)
    .single();

  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const sync = await getChunkedSyncStatus(store.id);
  return NextResponse.json({ ok: true, sync });
}
