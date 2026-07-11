import { Suspense } from "react";
import { PolarisProvider } from "@/components/providers/polaris-provider";
import { AppBridgeNav } from "@/components/layout/app-nav";
import { BillingGuard } from "@/components/billing-guard";
import { InstallGuard } from "@/components/install-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PolarisProvider>
      <AppBridgeNav>
        <Suspense fallback={null}>
          <InstallGuard>
            <BillingGuard>{children}</BillingGuard>
          </InstallGuard>
        </Suspense>
      </AppBridgeNav>
    </PolarisProvider>
  );
}
