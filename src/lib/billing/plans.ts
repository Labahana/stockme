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

/**
 * Shopify blocks the Billing API for custom/development apps. Detect that
 * specific error so we can gracefully bypass billing on dev stores.
 */
function isCustomAppBillingError(error: unknown): boolean {
  if (!error) return false;
  const message =
    (error instanceof Error ? error.message : String(error)) || "";
  if (
    message.toLowerCase().includes("custom apps cannot use the billing api") ||
    message.toLowerCase().includes("apps without a public distribution cannot use the billing api")
  ) {
    return true;
  }
  const data = (error as { errorData?: { message?: string }[] }).errorData;
  if (Array.isArray(data)) {
    return data.some(
      (d) =>
        d?.message?.toLowerCase().includes("custom apps cannot use the billing api") ||
        d?.message?.toLowerCase().includes("apps without a public distribution cannot use the billing api"),
    );
  }
  return false;
}

/** True when the app cannot use the Billing API (custom/development app). */
function billingApiUnavailable(error: unknown): boolean {
  if (process.env.SHOPIFY_BILLING_CUSTOM_APP === "true") return true;
  return billingIsTest() && isCustomAppBillingError(error);
}

/** True when billing enforcement is relaxed for dev/custom-app testing. */
export function billingBypassEnabled(): boolean {
  return process.env.SHOPIFY_BILLING_CUSTOM_APP === "true";
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
  /** True when the app is a custom app and billing was bypassed for dev testing. */
  billingBypassed?: boolean;
};

export async function syncStoreBilling(
  session: Session,
  storeId: string,
): Promise<BillingSyncResult> {
  const shopify = getShopify();
  try {
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
  } catch (error) {
    if (billingApiUnavailable(error)) {
      // Custom/development apps cannot use Shopify Billing. In test mode we
      // mark the store as active so the app can be used on a dev store.
      const planTier: PlanTier = "starter";
      const billingStatus: BillingSyncResult["billingStatus"] = "active";
      const supabase = createAdminClient();
      await supabase
        .from("stores")
        .update({ billing_status: billingStatus, plan_tier: planTier })
        .eq("id", storeId);
      return { hasActivePayment: true, planTier, billingStatus, billingBypassed: true };
    }
    throw error;
  }
}

export type SubscriptionRequestResult = {
  confirmationUrl: string | null;
  alreadyActive: boolean;
  billingBypassed?: boolean;
};

export async function requestSubscription(
  session: Session,
  plan: PlanTier,
  returnUrl: string,
): Promise<SubscriptionRequestResult> {
  const shopify = getShopify();
  try {
    const confirmationUrl = await shopify.billing.request({
      session,
      plan,
      isTest: billingIsTest(),
      returnUrl,
    });
    return { confirmationUrl, alreadyActive: false };
  } catch (error) {
    if (billingApiUnavailable(error)) {
      // Custom apps cannot create charges. Treat as already active in test mode.
      return { confirmationUrl: null, alreadyActive: true, billingBypassed: true };
    }
    throw error;
  }
}

export async function checkActiveSubscription(session: Session) {
  const shopify = getShopify();
  try {
    return await shopify.billing.check({
      session,
      plans: PLAN_NAMES,
      isTest: billingIsTest(),
    });
  } catch (error) {
    if (billingApiUnavailable(error)) {
      return true;
    }
    throw error;
  }
}
