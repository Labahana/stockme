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

    const bootstrapOfflineSession = async () => {
      const res = await shopFetch("/api/auth/session", shop, host, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data.error as string | undefined) ??
            `Could not connect store (${res.status})`,
        );
      }
    };

    const check = async (attempt = 0, didBootstrap = false) => {
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
        const notInstalled = message.toLowerCase().includes("not installed");

        // Managed install: exchange App Bridge session token for offline token.
        if (!didBootstrap && (notInstalled || res.status === 401) && attempt < 3) {
          try {
            await bootstrapOfflineSession();
            if (cancelled) return;
            window.setTimeout(() => {
              if (!cancelled) void check(attempt + 1, true);
            }, 200);
            return;
          } catch (bootstrapError) {
            console.error("Offline session bootstrap failed:", bootstrapError);
            // Fall through to session-token retries / missing UI
          }
        }

        // App Bridge token may not be ready on first paint — retry briefly
        if (
          (code === "SESSION_TOKEN_REQUIRED" || res.status === 401) &&
          !notInstalled &&
          attempt < 8
        ) {
          window.setTimeout(() => {
            if (!cancelled) void check(attempt + 1, didBootstrap);
          }, 400);
          return;
        }

        setState("missing");
        if (notInstalled) {
          setDetail(
            "Shopify installed the app, but Stockme could not create an offline API session yet. " +
              "Click Connect below to finish linking this store.",
          );
        } else if (code === "SESSION_TOKEN_REQUIRED") {
          setDetail(
            "Could not get an App Bridge session token. Reload the embedded app from Shopify Admin.",
          );
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
    const oauthUrl = authUrl
      ? `${authUrl}${authUrl.includes("?") ? "&" : "?"}oauth=1`
      : "";
    const billingRequired = searchParams.get("billing") === "required";

    return (
      <Page title="Stockme">
        <BlockStack gap="400">
          <Banner tone="warning">
            Stockme is not fully connected for {shop}. Finish linking your store to continue.
          </Banner>
          {detail && (
            <Banner tone="critical">
              <Text as="p">{detail}</Text>
            </Banner>
          )}
          <Button
            variant="primary"
            onClick={() => {
              setState("checking");
              setDetail(null);
              void (async () => {
                try {
                  await shopFetch("/api/auth/session", shop, host, {
                    method: "POST",
                  });
                  const res = await shopFetch("/api/billing", shop, host);
                  if (res.ok) {
                    setState("installed");
                    return;
                  }
                  const data = await res.json().catch(() => ({}));
                  setState("missing");
                  setDetail(
                    (data.error as string | undefined) ??
                      `Connection check failed (${res.status}).`,
                  );
                } catch {
                  setState("missing");
                  setDetail("Could not connect. Try again or use Install / reconnect.");
                }
              })();
            }}
          >
            Connect {shop}
          </Button>
          <Button
            onClick={() => {
              if (oauthUrl) window.open(oauthUrl, "_top");
            }}
          >
            Install / reconnect {shop}
          </Button>
          {billingRequired && (
            <Banner tone="info">
              After connecting, you will return here to choose a billing plan.
            </Banner>
          )}
        </BlockStack>
      </Page>
    );
  }

  return <>{children}</>;
}
