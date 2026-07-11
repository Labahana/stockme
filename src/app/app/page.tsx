"use client";

import { Suspense } from "react";
import { Page, Card, SkeletonBodyText } from "@shopify/polaris";
import DashboardContent from "./dashboard-content";

function DashboardFallback() {
  return (
    <Page title="Stockme">
      <Card>
        <SkeletonBodyText lines={4} />
      </Card>
    </Page>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <DashboardContent />
    </Suspense>
  );
}
