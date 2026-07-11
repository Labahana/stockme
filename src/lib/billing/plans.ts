import { getShopify } from "@/lib/shopify";
import { type PlanTier } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Session } from "@shopify/shopify-api";

const PLAN_NAMES: PlanTier[] = ["starter", "growth", "pro"];

export function billingIsTest() {
  // Default to test charges unless explicitly disabled (required for dev stores).
  if (process.env.SHOPIFY_BILLING_TEST === "false") return false;
  return true;
}

type SubscriptionLike = { name: string };

function resolvePlanTier(subscriptions: SubscriptionLike[]): PlanTier {
  const names = subscriptions.map((s) => s.name.toLowerCase());
  if (names.includes("pro")) return "pro";
  if (names.includes("growth")) return "growth";
  if (names.includes("starter")) return "starter";
  return "starter";
}

export type BillingSyncResult = {
  hasActivePayment: boolean;
  planTier: PlanTier;
  billingStatus: "trial" | "active" | "cancelled" | "frozen";
};

export async function syncStoreBilling(
  session: Session,
  storeId: string,
): Promise<BillingSyncResult> {
  const shopify = getShopify();
  const result = await shopify.billing.check({
    session,
    plans: PLAN_NAMES,
    isTest: billingIsTest(),
    returnObject: true,
  });

  const hasActivePayment = result.hasActivePayment;
  const planTier =
    hasActivePayment && result.appSubscriptions.length > 0
      ? resolvePlanTier(result.appSubscriptions)
      : undefined;

  const billingStatus = hasActivePayment ? "active" : "trial";

  const supabase = createAdminClient();
  const update: { billing_status: typeof billingStatus; plan_tier?: PlanTier } = {
    billing_status: billingStatus,
  };
  if (planTier) update.plan_tier = planTier;

  await supabase.from("stores").update(update).eq("id", storeId);

  const { data: store } = await supabase
    .from("stores")
    .select("plan_tier, billing_status")
    .eq("id", storeId)
    .single();

  return {
    hasActivePayment,
    planTier: (store?.plan_tier ?? planTier ?? "starter") as PlanTier,
    billingStatus: (store?.billing_status ?? billingStatus) as BillingSyncResult["billingStatus"],
  };
}

export async function requestSubscription(
  session: Session,
  plan: PlanTier,
  returnUrl: string,
) {
  const shopify = getShopify();
  return shopify.billing.request({
    session,
    plan,
    isTest: billingIsTest(),
    returnUrl,
  });
}

export async function checkActiveSubscription(session: Session) {
  const shopify = getShopify();
  return shopify.billing.check({
    session,
    plans: PLAN_NAMES,
    isTest: billingIsTest(),
  });
}
