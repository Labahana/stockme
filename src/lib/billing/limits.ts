import { BILLING_DISABLED_FOR_DEMO, PLAN_TIERS, type PlanTier } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Store } from "@/lib/types/database";

export function getPlanLimits(tier: PlanTier) {
  return PLAN_TIERS[tier];
}

export async function countShopVariants(shopId: string) {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("variants")
    .select("*", { count: "exact", head: true })
    .eq("shop_id", shopId);
  if (error) throw error;
  return count ?? 0;
}

export async function countShopLocations(shopId: string) {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("locations")
    .select("*", { count: "exact", head: true })
    .eq("shop_id", shopId);
  if (error) throw error;
  return count ?? 0;
}

export async function assertSkuLimit(store: Store) {
  // DEMO: no SKU ceiling
  if (BILLING_DISABLED_FOR_DEMO) return null;
  const limits = getPlanLimits(store.plan_tier);
  if (limits.maxSkus === null) return null;

  const count = await countShopVariants(store.id);
  if (count > limits.maxSkus) {
    return `Your ${limits.name} plan supports up to ${limits.maxSkus} SKUs. Upgrade to sync more products.`;
  }
  return null;
}

export function assertTransfersAllowed(store: Store) {
  // DEMO: transfers unlocked
  if (BILLING_DISABLED_FOR_DEMO) return null;
  if (store.plan_tier !== "starter") return null;
  return `Stock transfers require the ${PLAN_TIERS.growth.name} plan or higher.`;
}

export async function assertLocationLimit(store: Store, locationCount?: number) {
  // DEMO: all locations allowed
  if (BILLING_DISABLED_FOR_DEMO) return null;
  const limits = getPlanLimits(store.plan_tier);
  if (limits.locations === null) return null;

  const count = locationCount ?? (await countShopLocations(store.id));
  if (count > limits.locations) {
    return `Your ${limits.name} plan supports ${limits.locations} location. Upgrade for multi-location inventory.`;
  }
  return null;
}

export async function filterLocationsForPlan<T extends { id: string; is_primary: boolean }>(
  store: Store,
  locations: T[],
) {
  // DEMO: show every location
  if (BILLING_DISABLED_FOR_DEMO) return locations;
  const limits = getPlanLimits(store.plan_tier);
  if (limits.locations === null) return locations;
  const primary = locations.find((l) => l.is_primary) ?? locations[0];
  return primary ? [primary] : locations.slice(0, 1);
}

export function assertForecastMethodAllowed(store: Store, method: string) {
  // DEMO: all forecast methods
  if (BILLING_DISABLED_FOR_DEMO) return null;
  if (store.plan_tier !== "starter") return null;
  if (method === "last_x_days") return null;
  return `Advanced forecast methods require the ${PLAN_TIERS.growth.name} plan or higher.`;
}

export function assertScanReceiveAllowed(store: Store) {
  // DEMO: scan-to-receive unlocked
  if (BILLING_DISABLED_FOR_DEMO) return null;
  if (store.plan_tier !== "starter") return null;
  return `Barcode scan-to-receive requires the ${PLAN_TIERS.growth.name} plan or higher.`;
}

export function assertConsolidatedViewAllowed(store: Store) {
  // DEMO: consolidated view unlocked
  if (BILLING_DISABLED_FOR_DEMO) return null;
  if (store.plan_tier !== "starter") return null;
  return `Cross-location inventory view requires the ${PLAN_TIERS.growth.name} plan or higher.`;
}

export function assertPartialInvoiceAllowed(store: Store) {
  // DEMO: per-shipment invoices unlocked
  if (BILLING_DISABLED_FOR_DEMO) return null;
  if (store.plan_tier === "pro") return null;
  return `Per-shipment invoice recording requires the ${PLAN_TIERS.pro.name} plan.`;
}

export function assertBundleCostReports(store: Store) {
  // DEMO: bundle-aware reports unlocked
  if (BILLING_DISABLED_FOR_DEMO) return null;
  if (store.plan_tier === "pro") return null;
  return `Bundle-aware valuation requires the ${PLAN_TIERS.pro.name} plan.`;
}

export function assertSupplierPerformanceReport(store: Store) {
  // DEMO: supplier performance unlocked
  if (BILLING_DISABLED_FOR_DEMO) return null;
  if (store.plan_tier !== "starter") return null;
  return `Supplier performance reports require the ${PLAN_TIERS.growth.name} plan or higher.`;
}
