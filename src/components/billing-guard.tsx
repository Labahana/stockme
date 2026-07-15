"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AppLoading } from "@/components/app-loading";
import { shopFetch, useHost, useShop } from "@/lib/hooks/use-shop";

export function BillingGuard({ children }: { children: React.ReactNode }) {
  const shop = useShop();
  const host = useHost();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checked, setChecked] = useState(false);
  const onSettings = pathname.startsWith("/app/settings");
  const onOnboarding = pathname.startsWith("/app/onboarding");

  useEffect(() => {
    if (onSettings || onOnboarding) {
      setChecked(true);
      return;
    }

    if (!shop) return;

    setChecked(false);
    let cancelled = false;

    shopFetch("/api/billing", shop, host)
      .then(async (r) => {
        if (cancelled) return;
        const data = await r.json().catch(() => ({}));
        if (!data.hasActivePayment && !data.billingBypassed) {
          const params = new URLSearchParams();
          params.set("shop", shop);
          if (host) params.set("host", host);
          params.set("billing", "required");
          router.replace(`/app/settings?${params.toString()}`);
          return;
        }
        setChecked(true);
      })
      .catch(() => {
        if (cancelled) return;
        const params = new URLSearchParams();
        params.set("shop", shop);
        if (host) params.set("host", host);
        params.set("billing", "required");
        router.replace(`/app/settings?${params.toString()}`);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router, shop, host, onSettings, onOnboarding]);

  useEffect(() => {
    if (searchParams.get("billing") === "confirmed" && shop) {
      let cancelled = false;
      shopFetch("/api/billing", shop, host)
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          setChecked(Boolean(data.hasActivePayment || data.billingBypassed));
        })
        .catch(() => {
          if (cancelled) return;
          setChecked(false);
        });
      return () => {
        cancelled = true;
      };
    }
  }, [searchParams, shop, host]);

  if (!checked && !onSettings && !onOnboarding) {
    return <AppLoading message="Checking subscription…" />;
  }

  return <>{children}</>;
}
