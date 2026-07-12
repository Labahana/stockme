"use client";

import { ReactNode } from "react";

// Billing enforcement disabled for initial dev/testing. Restore the original
// BillingGuard (checks /api/billing and redirects to /app/settings when needed)
// when billing is configured.
export function BillingGuard({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
