"use client";

import { Suspense } from "react";
import { Page, Card, SkeletonBodyText } from "@shopify/polaris";
import { ReportsPageClient } from "@/components/reports/reports-page";

export default function ReportsPage() {
  return (
    <Suspense fallback={<Page title="Reports"><Card><SkeletonBodyText /></Card></Page>}>
      <ReportsPageClient />
    </Suspense>
  );
}
