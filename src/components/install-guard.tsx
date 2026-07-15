"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Banner, BlockStack, Button, Page } from "@shopify/polaris";
import { AppLoading } from "@/components/app-loading";
import { installUrl, shopFetch, useHost, useShop } from "@/lib/hooks/use-shop";

type InstallState = "waiting" | "checking" | "installed" | "missing";

export function InstallGuard({ children }: { children: React.ReactNode }) {
  const shop = useShop();
  const host = useHost();
  const searchParams = useSearchParams();
  const [state, setState] = useState<InstallState>("waiting");

  useEffect(() => {
    if (!shop) {
      const timer = window.setTimeout(() => {
        setState((current) => (current === "waiting" ? "missing" : current));
      }, 3000);
      return () => window.clearTimeout(timer);
    }

    setState("checking");
    let cancelled = false;

    shopFetch("/api/billing", shop, host)
      .then(async (r) => {
        if (cancelled) return;
        if (!r.ok) {
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

  if (!shop || state === "waiting" || state === "checking") {
    return <AppLoading message={shop ? "Checking store connection…" : "Connecting to Shopify…"} />;
  }

  if (state === "missing") {
    const authUrl = installUrl(shop, host);
    const billingRequired = searchParams.get("billing") === "required";

    return (
      <Page title="Stockme">
        <BlockStack gap="400">
          <Banner tone="warning">
            Stockme is not fully installed for {shop}. Complete OAuth once to connect your store
            before billing or sync will work.
          </Banner>
          <Button
            variant="primary"
            onClick={() => {
              if (authUrl) window.open(authUrl, "_top");
            }}
          >
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
