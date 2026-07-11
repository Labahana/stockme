"use client";

import { Suspense } from "react";
import { Page, Card, SkeletonBodyText } from "@shopify/polaris";
import { TransfersPageClient } from "@/components/transfers/transfers-page";

export default function TransfersPage() {
  return (
    <Suspense fallback={<Page title="Transfers"><Card><SkeletonBodyText /></Card></Page>}>
      <TransfersPageClient />
    </Suspense>
  );
}
