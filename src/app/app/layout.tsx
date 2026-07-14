import { Suspense } from "react";
import { AppLoading } from "@/components/app-loading";
import { PolarisProvider } from "@/components/providers/polaris-provider";
import { AppBridgeNav } from "@/components/layout/app-nav";
import { AppShell } from "@/components/layout/AppShell";
import { BillingGuard } from "@/components/billing-guard";
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
              <BillingGuard>{children}</BillingGuard>
            </InstallGuard>
          </Suspense>
        </AppShell>
      </AppBridgeNav>
    </PolarisProvider>
  );
}
