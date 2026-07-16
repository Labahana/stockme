"use client";

import { useEffect, useState } from "react";
import { BILLING_DISABLED_FOR_DEMO, PLAN_TIERS, type PlanTier } from "@/lib/constants";
import { shopFetch, useHost, useShop } from "@/lib/hooks/use-shop";

export type PlanFeatures = {
  planTier: PlanTier;
  loading: boolean;
  canTransfer: boolean;
  canScanReceive: boolean;
  canConsolidatedView: boolean;
  canAdvancedForecast: boolean;
  canPartialInvoice: boolean;
  canBundleValuation: boolean;
  canSupplierPerformance: boolean;
  maxSkus: number | null;
  maxLocations: number | null;
};

export function usePlanFeatures(): PlanFeatures {
  const shop = useShop();
  const host = useHost();
  // DEMO: treat every merchant as Pro with all features unlocked
  const [planTier, setPlanTier] = useState<PlanTier>(
    BILLING_DISABLED_FOR_DEMO ? "pro" : "starter",
  );
  const [loading, setLoading] = useState(!BILLING_DISABLED_FOR_DEMO);

  useEffect(() => {
    if (BILLING_DISABLED_FOR_DEMO) {
      setPlanTier("pro");
      setLoading(false);
      return;
    }
    if (!shop) {
      setLoading(false);
      return;
    }
    shopFetch("/api/billing", shop, host)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        setPlanTier(d.planTier ?? "starter");
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [shop, host]);

  const tier = PLAN_TIERS[planTier];
  const isGrowthPlus = BILLING_DISABLED_FOR_DEMO || planTier !== "starter";
  const isPro = BILLING_DISABLED_FOR_DEMO || planTier === "pro";

  return {
    planTier,
    loading,
    canTransfer: isGrowthPlus,
    canScanReceive: isGrowthPlus,
    canConsolidatedView: isGrowthPlus,
    canAdvancedForecast: isGrowthPlus,
    canPartialInvoice: isPro,
    canBundleValuation: isPro,
    canSupplierPerformance: isGrowthPlus,
    maxSkus: BILLING_DISABLED_FOR_DEMO ? null : tier.maxSkus,
    maxLocations: BILLING_DISABLED_FOR_DEMO ? null : tier.locations,
  };
}
