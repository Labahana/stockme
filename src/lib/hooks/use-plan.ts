"use client";

import { useEffect, useState } from "react";
import { PLAN_TIERS, type PlanTier } from "@/lib/constants";
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
  const [planTier, setPlanTier] = useState<PlanTier>("starter");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  const isGrowthPlus = planTier !== "starter";
  const isPro = planTier === "pro";

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
    maxSkus: tier.maxSkus,
    maxLocations: tier.locations,
  };
}
