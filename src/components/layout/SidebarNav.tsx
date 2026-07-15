"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { StockmeMark } from "@/components/brand/StockmeLogo";
import { useHost, useShop } from "@/lib/hooks/use-shop";
import { APP_NAME, PLAN_TIERS, type PlanTier } from "@/lib/constants";
import { usePlanFeatures } from "@/lib/hooks/use-plan";

type NavItem = { href: string; label: string; icon: string };

const SECTIONS: NavItem[][] = [
  [{ href: "/app", label: "Dashboard", icon: "⌂" }],
  [
    { href: "/app/purchase-orders", label: "Purchase Orders", icon: "☰" },
    { href: "/app/inventory", label: "Inventory", icon: "▦" },
    { href: "/app/vendors", label: "Vendors", icon: "🏪" },
    { href: "/app/reports", label: "Reports", icon: "◔" },
  ],
  [
    { href: "/app/transfers", label: "Transfers", icon: "⇄" },
    { href: "/app/stock-takes", label: "Stock Takes", icon: "☑" },
  ],
  [
    { href: "/app/settings", label: "Settings", icon: "⚙" },
    { href: "/app/import", label: "Import from Stocky", icon: "⬇" },
  ],
];

function withParams(href: string, shop: string, host: string) {
  const params = new URLSearchParams();
  if (shop) params.set("shop", shop);
  if (host) params.set("host", host);
  const qs = params.toString();
  return qs ? `${href}?${qs}` : href;
}

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app" || pathname === "/app/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({
  open,
  onNavigate,
}: {
  open?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const shop = useShop();
  const host = useHost();
  const plan = usePlanFeatures();
  const tier = (plan.planTier as PlanTier) || "starter";
  const tierMeta = PLAN_TIERS[tier] ?? PLAN_TIERS.starter;

  return (
    <aside className={`stockme-sidebar${open ? " is-open" : ""}`}>
      <div className="stockme-sidebar__brand">
        <StockmeMark size={30} />
        <span className="label">{APP_NAME}</span>
      </div>

      <nav className="stockme-sidebar__nav" aria-label="StockMe">
        {SECTIONS.map((section, idx) => (
          <div key={idx} className="stockme-sidebar__section">
            {section.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={withParams(item.href, shop, host)}
                  className={`stockme-sidebar__link${active ? " is-active" : ""}`}
                  onClick={onNavigate}
                >
                  <span aria-hidden>{item.icon}</span>
                  <span className="label">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="stockme-sidebar__footer">
        <div>
          {tierMeta.name} ${tierMeta.price}/mo
        </div>
        <div>Independently built · not going anywhere</div>
      </div>
    </aside>
  );
}
