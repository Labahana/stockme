"use client";

import { NavMenu } from "@shopify/app-bridge-react";
import { ReactNode, Suspense } from "react";
import { useHost, useShop } from "@/lib/hooks/use-shop";

/** Matches Stocky by Shopify navigation IA */
const NAV_ITEMS: { href: string; label: string; rel?: string }[] = [
  { href: "/app", label: "Home", rel: "home" },
  { href: "/app/inventory", label: "Inventory" },
  { href: "/app/purchase-orders", label: "Purchases" },
  { href: "/app/stocktakes", label: "Stocktakes" },
  { href: "/app/transfers", label: "Transfers" },
  { href: "/app/suppliers", label: "Suppliers" },
  { href: "/app/reports", label: "Reports" },
  { href: "/app/settings", label: "Settings" },
];

function NavLinks() {
  const shop = useShop();
  const host = useHost();

  const withParams = (href: string) => {
    const params = new URLSearchParams();
    if (shop) params.set("shop", shop);
    if (host) params.set("host", host);
    const qs = params.toString();
    return qs ? `${href}?${qs}` : href;
  };

  return (
    <NavMenu>
      {NAV_ITEMS.map(({ href, label, rel }) => (
        <a key={href} href={withParams(href)} rel={rel}>
          {label}
        </a>
      ))}
    </NavMenu>
  );
}

export function AppBridgeNav({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <NavLinks />
      </Suspense>
      {children}
    </>
  );
}
