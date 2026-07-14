import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import { archiveOldPurchaseOrders } from "@/lib/archive";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Free-tier health: approximate table row counts so you can watch the 500 MB wall. */
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request, { skipBilling: true });
    if (isNextResponse(ctx)) return ctx;

    const supabase = createAdminClient();
    const tables = [
      "products",
      "variants",
      "inventory_levels",
      "purchase_orders",
      "po_line_items",
      "webhook_logs",
      "sync_runs",
      "stocktakes",
    ] as const;

    const counts: Record<string, number> = {};
    for (const table of tables) {
      const { count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("shop_id", ctx.store.id);
      counts[table] = count ?? 0;
    }

    // Rough heuristic bytes (from free-tier guide estimates)
    const estimateMb =
      (counts.variants * 400 +
        counts.inventory_levels * 200 +
        counts.purchase_orders * 2000 +
        counts.po_line_items * 500 +
        counts.webhook_logs * 50 +
        counts.sync_runs * 200) /
      (1024 * 1024);

    const yellow = estimateMb >= 350;
    const red = estimateMb >= 450;

    return NextResponse.json({
      shop: ctx.shop,
      counts,
      estimatedDbMb: Number(estimateMb.toFixed(2)),
      alert: red ? "red" : yellow ? "yellow" : "ok",
      tip:
        red
          ? "Near free-tier DB limit — run archive / purge or upgrade Supabase Pro"
          : yellow
            ? "Approaching 500 MB — enable archiving and confirm daily cron is running"
            : "Within free-tier headroom (estimate; check Supabase Dashboard for exact size)",
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Health check failed" }, { status: 500 });
  }
}

/** Manually archive this shop's old received POs (90 days). */
export async function POST(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request, { skipBilling: true });
    if (isNextResponse(ctx)) return ctx;

    const body = await request.json().catch(() => ({}));
    const daysOld = typeof body.daysOld === "number" ? body.daysOld : 90;
    const result = await archiveOldPurchaseOrders(ctx.store.id, daysOld);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Archive failed" },
      { status: 500 },
    );
  }
}
