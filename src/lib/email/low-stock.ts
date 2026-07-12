import { createAdminClient } from "@/lib/supabase/admin";
import { reportLowStock } from "@/lib/reports";
import { getFromEmail, getResendClient, requireResendInProduction } from "@/lib/email/client";
import type { PlanTier } from "@/lib/constants";

/** Free-tier Resend budget: fewer digests for lower plans. */
function shouldSendDigestToday(planTier: PlanTier, now = new Date()) {
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  if (planTier === "pro") return true; // daily
  if (planTier === "growth") return day === 1 || day === 4; // Mon, Thu
  return day === 1; // starter: Monday only
}

export async function sendLowStockDigestForShop(shopId: string, shopDomain: string) {
  const supabase = createAdminClient();
  const { data: store, error } = await supabase
    .from("stores")
    .select("id, email, low_stock_digest_enabled, plan_tier")
    .eq("id", shopId)
    .single();

  if (error || !store?.low_stock_digest_enabled || !store.email) {
    return { sent: false, reason: "digest_disabled_or_no_email" };
  }

  const plan = (store.plan_tier as PlanTier) || "starter";
  if (!shouldSendDigestToday(plan)) {
    return { sent: false, reason: "skipped_for_plan_frequency" };
  }

  const emailCheck = requireResendInProduction();
  if (!emailCheck.ok) {
    return { sent: false, reason: emailCheck.reason };
  }

  const resend = getResendClient();
  if (!resend) {
    return { sent: false, reason: "resend_not_configured" };
  }

  const { rows, totals } = await reportLowStock(shopId);
  if (rows.length === 0) {
    return { sent: false, reason: "no_low_stock" };
  }

  const lines = rows
    .slice(0, 50)
    .map(
      (r) =>
        `${r.sku || r.variant} @ ${r.location}: ${r.available} available (min ${r.min_stock}, short ${r.shortfall})`,
    )
    .join("\n");

  const body = `Low stock digest for ${shopDomain}\n\n${totals.count} items below minimum (${totals.totalShortfall} units short)\n\n${lines}${
    rows.length > 50 ? `\n\n...and ${rows.length - 50} more` : ""
  }`;

  await resend.emails.send({
    from: getFromEmail(),
    to: store.email,
    subject: `Stockme: ${totals.count} low-stock items`,
    text: body,
  });

  return { sent: true, count: totals.count, plan };
}

export async function sendAllLowStockDigests() {
  const supabase = createAdminClient();
  const { data: stores, error } = await supabase
    .from("stores")
    .select("id, shop_domain, low_stock_digest_enabled, email, plan_tier")
    .eq("low_stock_digest_enabled", true);

  if (error) throw error;

  const results = [];
  for (const store of stores ?? []) {
    if (!store.email) continue;
    results.push({
      shop: store.shop_domain,
      ...(await sendLowStockDigestForShop(store.id, store.shop_domain)),
    });
  }
  return results;
}
