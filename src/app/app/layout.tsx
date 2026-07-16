import { Suspense } from "react";
import { AppLoading } from "@/components/app-loading";
import { PolarisProvider } from "@/components/providers/polaris-provider";
import { AppBridgeNav } from "@/components/layout/app-nav";
import { AppShell } from "@/components/layout/AppShell";
// DEMO: billing gate commented out — re-enable before App Store launch
// import { BillingGuard } from "@/components/billing-guard";
import { InstallGuard } from "@/components/install-guard";

/** Embedded Shopify app — always dynamic; never SSG (useSearchParams / App Bridge). */
export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PolarisProvider>
      <AppBridgeNav>
        <AppShell>
          <Suspense fallback={<AppLoading />}>
            <InstallGuard>
              {/* DEMO: skip BillingGuard so merchants can use the app without a subscription */}
              {/* <BillingGuard>{children}</BillingGuard> */}
              {children}
            </InstallGuard>
          </Suspense>
        </AppShell>
      </AppBridgeNav>
    </PolarisProvider>
  );
}
