"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Banner, BlockStack, Button, Page, Text } from "@shopify/polaris";
import { AppLoading } from "@/components/app-loading";
import { installUrl, shopFetch, useHost, useShop } from "@/lib/hooks/use-shop";

type InstallState = "waiting" | "checking" | "installed" | "missing";

export function InstallGuard({ children }: { children: React.ReactNode }) {
  const shop = useShop();
  const host = useHost();
  const searchParams = useSearchParams();
  const [state, setState] = useState<InstallState>("waiting");
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    if (!shop) {
      const timer = window.setTimeout(() => {
        setState((current) => (current === "waiting" ? "missing" : current));
        setDetail("No shop domain found in the embedded app URL.");
      }, 3000);
      return () => window.clearTimeout(timer);
    }

    setState("checking");
    setDetail(null);
    let cancelled = false;

    const check = async (attempt = 0) => {
      try {
        const res = await shopFetch("/api/billing", shop, host);
        if (cancelled) return;

        if (res.ok) {
          setState("installed");
          return;
        }

        const data = await res.json().catch(() => ({}));
        const code = data.code as string | undefined;
        const message = (data.error as string | undefined) ?? "";

        // App Bridge token may not be ready on first paint — retry briefly
        if (
          (code === "SESSION_TOKEN_REQUIRED" || res.status === 401) &&
          !message.toLowerCase().includes("not installed") &&
          attempt < 8
        ) {
          window.setTimeout(() => {
            if (!cancelled) void check(attempt + 1);
          }, 400);
          return;
        }

        setState("missing");
        if (message.toLowerCase().includes("not installed")) {
          setDetail(
            "OAuth did not finish — no offline access token is stored for this shop. " +
              "Usually the Partner Dashboard Allowed redirection URL does not match " +
              "NEXT_PUBLIC_APP_URL + /api/auth/callback (must be exact).",
          );
        } else if (code === "SESSION_TOKEN_REQUIRED") {
          setDetail("Could not get an App Bridge session token. Reload the embedded app from Shopify Admin.");
        } else {
          setDetail(message || `Connection check failed (${res.status}).`);
        }
      } catch {
        if (!cancelled) {
          setState("missing");
          setDetail("Network error while checking install status.");
        }
      }
    };

    void check();

    return () => {
      cancelled = true;
    };
  }, [shop, host]);

  if (!shop || state === "waiting" || state === "checking") {
    return (
      <AppLoading
        message={shop ? "Checking store connection…" : "Connecting to Shopify…"}
      />
    );
  }

  if (state === "missing") {
    const authUrl = installUrl(shop, host);
    const billingRequired = searchParams.get("billing") === "required";

    return (
      <Page title="Stockme">
        <BlockStack gap="400">
          <Banner tone="warning">
            Stockme is not fully installed for {shop}. Complete OAuth once to connect your store
            before sync will work.
          </Banner>
          {detail && (
            <Banner tone="critical">
              <Text as="p">{detail}</Text>
            </Banner>
          )}
          <Banner tone="info">
            If Install opens then shows &quot;redirect_uri is not whitelisted&quot;, fix Partner
            Dashboard → Allowed redirection URL to exactly:{" "}
            <Text as="span" fontWeight="semibold">
              https://stockme.gentletap.co/api/auth/callback
            </Text>{" "}
            (must match Vercel <code>NEXT_PUBLIC_APP_URL</code>), then click Install again.
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
