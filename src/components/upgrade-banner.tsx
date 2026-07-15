"use client";

import { Banner } from "@shopify/polaris";
import { PLAN_TIERS } from "@/lib/constants";
import type { PlanTier } from "@/lib/constants";

type UpgradeBannerProps = {
  planTier: PlanTier;
  feature: string;
  requiredTier?: Exclude<PlanTier, "starter">;
  shop?: string;
};

export function UpgradeBanner({
  planTier,
  feature,
  requiredTier = "growth",
  shop,
}: UpgradeBannerProps) {
  const tierOrder: PlanTier[] = ["starter", "growth", "pro"];
  const currentIdx = tierOrder.indexOf(planTier);
  const requiredIdx = tierOrder.indexOf(requiredTier);

  if (currentIdx >= requiredIdx) return null;

  const qs = shop ? `?shop=${encodeURIComponent(shop)}` : "";
  const tierName = PLAN_TIERS[requiredTier].name;

  return (
    <Banner
      tone="warning"
      action={{ content: "Upgrade plan", url: `/app/settings${qs}` }}
    >
      {feature} requires the {tierName} plan.
    </Banner>
  );
}
