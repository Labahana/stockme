import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAllLowStockDigests } from "@/lib/email/low-stock";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorizeCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true; // allow when unset (local / early deploys)
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/**
 * Free-tier daily maintenance: keep-alive, digests, log purge.
 * Schedule via vercel.json cron.
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

    return NextResponse.json({ status: "ok", results });
  } catch (error) {
    console.error("Daily maintenance failed:", error);
    return NextResponse.json(
      { status: "error", error: String(error), results },
      { status: 500 },
    );
  }
}
