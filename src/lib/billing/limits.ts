import { PLAN_TIERS, type PlanTier } from "@/lib/constants";
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
  const limits = getPlanLimits(store.plan_tier);
  if (limits.maxSkus === null) return null;

  const count = await countShopVariants(store.id);
  if (count > limits.maxSkus) {
    return `Your ${limits.name} plan supports up to ${limits.maxSkus} SKUs. Upgrade to sync more products.`;
  }
  return null;
}

export function assertTransfersAllowed(store: Store) {
  if (store.plan_tier !== "starter") return null;
  return `Stock transfers require the ${PLAN_TIERS.growth.name} plan or higher.`;
}

export async function assertLocationLimit(store: Store, locationCount?: number) {
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
  const limits = getPlanLimits(store.plan_tier);
  if (limits.locations === null) return locations;
  const primary = locations.find((l) => l.is_primary) ?? locations[0];
  return primary ? [primary] : locations.slice(0, 1);
}

export function assertForecastMethodAllowed(store: Store, method: string) {
  if (store.plan_tier !== "starter") return null;
  if (method === "last_x_days") return null;
  return `Advanced forecast methods require the ${PLAN_TIERS.growth.name} plan or higher.`;
}

export function assertScanReceiveAllowed(store: Store) {
  if (store.plan_tier !== "starter") return null;
  return `Barcode scan-to-receive requires the ${PLAN_TIERS.growth.name} plan or higher.`;
}

export function assertConsolidatedViewAllowed(store: Store) {
  if (store.plan_tier !== "starter") return null;
  return `Cross-location inventory view requires the ${PLAN_TIERS.growth.name} plan or higher.`;
}

export function assertPartialInvoiceAllowed(store: Store) {
  if (store.plan_tier === "pro") return null;
  return `Per-shipment invoice recording requires the ${PLAN_TIERS.pro.name} plan.`;
}

export function assertBundleCostReports(store: Store) {
  if (store.plan_tier === "pro") return null;
  return `Bundle-aware valuation requires the ${PLAN_TIERS.pro.name} plan.`;
}

export function assertSupplierPerformanceReport(store: Store) {
  if (store.plan_tier !== "starter") return null;
  return `Supplier performance reports require the ${PLAN_TIERS.growth.name} plan or higher.`;
}
