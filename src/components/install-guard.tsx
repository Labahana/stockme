"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Banner, BlockStack, Button, Page } from "@shopify/polaris";
import { apiUrl, useHost, useShop } from "@/lib/hooks/use-shop";

type InstallState = "checking" | "installed" | "missing";

export function InstallGuard({ children }: { children: React.ReactNode }) {
  const shop = useShop();
  const host = useHost();
  const searchParams = useSearchParams();
  const [state, setState] = useState<InstallState>("checking");

  useEffect(() => {
    if (!shop) {
      setState("missing");
      return;
    }

    let cancelled = false;
    fetch(apiUrl("/api/billing", shop, host), { skipBilling: "1" } as RequestInit)
      .catch(() => fetch(apiUrl("/api/billing", shop, host)))
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 401) {
          setState("missing");
          return;
        }
        setState("installed");
      })
      .catch(() => {
        if (!cancelled) setState("missing");
      });

    return () => {
      cancelled = true;
    };
  }, [shop, host]);

  if (state === "checking") {
    return null;
  }

  if (state === "missing" && shop) {
    const installUrl = `/api/auth?shop=${encodeURIComponent(shop)}${host ? `&host=${encodeURIComponent(host)}` : ""}`;
    const billingRequired = searchParams.get("billing") === "required";

    return (
      <Page title="Stockme">
        <BlockStack gap="400">
          <Banner tone="warning">
            Stockme is not fully installed for {shop}. Complete OAuth once to connect your store
            before billing or sync will work.
          </Banner>
          <Button url={installUrl} variant="primary">
            Install / reconnect {shop}
          </Button>
          {billingRequired && (
            <Banner tone="info">
              After installing, you will return here to choose a billing plan.
            </Banner>
          )}
        </BlockStack>
      </Page>
    );
  }

  return <>{children}</>;
}
