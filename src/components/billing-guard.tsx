"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiUrl, useHost, useShop } from "@/lib/hooks/use-shop";

export function BillingGuard({ children }: { children: React.ReactNode }) {
  const shop = useShop();
  const host = useHost();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (pathname.startsWith("/app/settings")) {
      setChecked(true);
      return;
    }

    setChecked(false);

    let cancelled = false;

    fetch(apiUrl("/api/billing", shop, host))
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.hasActivePayment) {
          const params = new URLSearchParams();
          if (shop) params.set("shop", shop);
          params.set("billing", "required");
          router.replace(`/app/settings?${params.toString()}`);
        } else {
          setChecked(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        // On failure, keep blocking — never grant access on error.
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, router, shop, host]);

  useEffect(() => {
    if (searchParams.get("billing") === "confirmed") {
      let cancelled = false;
      fetch(apiUrl("/api/billing", shop, host))
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          setChecked(Boolean(data.hasActivePayment));
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

  if (!checked && !pathname.startsWith("/app/settings")) {
    return null;
  }

  return <>{children}</>;
}
