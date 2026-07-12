"use client";

import { Banner, BlockStack, Button, Text } from "@shopify/polaris";
import type { ReactNode } from "react";
import { PLAN_TIERS, type PlanTier } from "@/lib/constants";

/**
 * Soft feature gate UI. Billing enforcement is currently disabled for
 * testing — this still surfaces upgrade messaging when `allowed` is false.
 */
export function PlanGate({
  allowed,
  feature,
  requiredTier = "growth",
  shop,
  children,
}: {
  allowed: boolean;
  feature: string;
  requiredTier?: PlanTier | PlanTier[];
  shop?: string;
  children: ReactNode;
}) {
  if (allowed) return <>{children}</>;

  const tiers = Array.isArray(requiredTier) ? requiredTier : [requiredTier];
  const names = tiers.map((t) => PLAN_TIERS[t].name).join(" / ");
  const qs = shop ? `?shop=${encodeURIComponent(shop)}` : "";

  return (
    <Banner tone="warning" title={`${feature} requires ${names}`}>
      <BlockStack gap="200">
        <Text as="p">
          Upgrade in Settings when billing is enabled. For now you can continue testing
          core inventory workflows.
        </Text>
        <Button url={`/app/settings${qs}`}>Open Settings</Button>
      </BlockStack>
    </Banner>
  );
}
