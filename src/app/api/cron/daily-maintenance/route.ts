import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAllLowStockDigests } from "@/lib/email/low-stock";
import { archiveOldPurchaseOrdersForAllShops } from "@/lib/archive";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorizeCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Free-tier daily maintenance: keep-alive, digests, purge, archive, vacuum.
 * Schedule via vercel.json cron (09:00 UTC).
 */
export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const results = {
    keepAlive: false,
    digestsSent: 0,
    webhookLogsPurged: 0,
    syncRunsPurged: 0,
    stocktakesPurged: 0,
    posArchived: 0,
    archiveBytesFreed: 0,
    vacuumed: false,
    archiveErrors: [] as string[],
  };

  try {
    // 1. Keep-alive ping (prevents Supabase free 7-day pause)
    const { error: pingError } = await supabase
      .from("stores")
      .select("id", { count: "exact", head: true });
    results.keepAlive = !pingError;

    // 2. Digests (smart frequency inside sendAllLowStockDigests)
    const digestResults = await sendAllLowStockDigests();
    results.digestsSent = digestResults.filter((r) => r.sent).length;

    // 3. Purge webhook metadata logs older than 7 days
    const { data: whPurged } = await supabase.rpc("purge_old_webhook_logs", {
      days_old: 7,
    });
    results.webhookLogsPurged = Number(whPurged ?? 0);

    // 4. Purge old sync_runs (14 days)
    const { data: syncPurged } = await supabase.rpc("purge_old_sync_runs", {
      days_old: 14,
    });
    results.syncRunsPurged = Number(syncPurged ?? 0);

    // 5. Purge completed stocktakes older than 90 days
    const stocktakeCutoff = new Date(
      Date.now() - 90 * 24 * 60 * 60 * 1000,
    ).toISOString();
    try {
      const { data: stPurged, error: stRpcError } = await supabase.rpc(
        "purge_old_completed_stocktakes",
        { days_old: 90 },
      );
      if (stRpcError) throw stRpcError;
      results.stocktakesPurged = Number(stPurged ?? 0);
    } catch {
      // Fallback until migration 007 RPCs are applied
      const { data: oldTakes, error: listError } = await supabase
        .from("stocktakes")
        .select("id")
        .eq("status", "completed")
        .lt("completed_at", stocktakeCutoff)
        .limit(500);
      if (!listError && oldTakes?.length) {
        const { error: delError } = await supabase
          .from("stocktakes")
          .delete()
          .in(
            "id",
            oldTakes.map((t) => t.id),
          );
        if (!delError) results.stocktakesPurged = oldTakes.length;
      }
    }

    // 6. Archive received POs older than 90 days → Storage
    try {
      const archive = await archiveOldPurchaseOrdersForAllShops(90);
      results.posArchived = archive.archived;
      results.archiveBytesFreed = archive.bytesFreed;
      results.archiveErrors = archive.errors.slice(0, 5);
    } catch (err) {
      results.archiveErrors.push(err instanceof Error ? err.message : "archive failed");
    }

    // 7. Weekly ANALYZE on Sundays (VACUUM must be run from Supabase Dashboard)
    if (new Date().getUTCDay() === 0) {
      try {
        await supabase.rpc("run_maintenance_analyze");
        results.vacuumed = true;
      } catch {
        results.vacuumed = false;
      }
    }

    return NextResponse.json({ status: "ok", results });
  } catch (error) {
    console.error("Daily maintenance failed:", error);
    return NextResponse.json(
      { status: "error", error: String(error), results },
      { status: 500 },
    );
  }
}
