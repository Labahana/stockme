import { Suspense } from "react";
import { AppLoading } from "@/components/app-loading";
import { PolarisProvider } from "@/components/providers/polaris-provider";
import { AppBridgeNav } from "@/components/layout/app-nav";
import { BillingGuard } from "@/components/billing-guard";
import { InstallGuard } from "@/components/install-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PolarisProvider>
      <AppBridgeNav>
        <Suspense fallback={<AppLoading />}>
          <InstallGuard>
            <BillingGuard>{children}</BillingGuard>
          </InstallGuard>
        </Suspense>
      </AppBridgeNav>
    </PolarisProvider>
  );
}
