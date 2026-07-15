"use client";

import { Banner, BlockStack, Button, Text } from "@shopify/polaris";
import type { ReactNode } from "react";
import { PLAN_TIERS, type PlanTier } from "@/lib/constants";
import { usePlanFeatures } from "@/lib/hooks/use-plan";
import { useShop } from "@/lib/hooks/use-shop";

const LEVEL: Record<PlanTier, number> = {
  starter: 1,
  growth: 2,
  pro: 3,
};

/** Spec §15 — upgrade banner instead of silent fail. */
export function PlanGate({
  requiredPlan = "growth",
  featureName,
  feature,
  allowed,
  children,
}: {
  requiredPlan?: PlanTier;
  featureName?: string;
  feature?: string;
  /** When set, overrides plan check (useful while billing is disabled). */
  allowed?: boolean;
  children: ReactNode;
}) {
  const shop = useShop();
  const plan = usePlanFeatures();
  const name = featureName ?? feature ?? "This feature";
  const current = (plan.planTier as PlanTier) || "starter";
  const ok =
    allowed !== undefined
      ? allowed
      : LEVEL[current] >= LEVEL[requiredPlan];

  if (ok) return <>{children}</>;

  const qs = shop ? `?shop=${encodeURIComponent(shop)}&tab=billing` : "?tab=billing";

  return (
    <Banner tone="info" title={`${name} requires ${PLAN_TIERS[requiredPlan].name}`}>
      <BlockStack gap="200">
        <Text as="p">
          Upgrade to unlock {name.toLowerCase()}. You can change plans anytime in Settings.
        </Text>
        <Button url={`/app/settings${qs}`}>Upgrade now</Button>
      </BlockStack>
    </Banner>
  );
}
