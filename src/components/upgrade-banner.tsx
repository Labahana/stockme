"use client";

import type { PlanTier } from "@/lib/constants";

// Upgrade banner disabled for initial dev/testing. Restore when billing is
// configured.
export function UpgradeBanner(props: {
  planTier: PlanTier;
  feature: string;
  requiredTier?: Exclude<PlanTier, "starter">;
  shop?: string;
}) {
  void props;
  return null;
}
