"use client";

import { Suspense } from "react";
import { Page, Card, SkeletonBodyText } from "@shopify/polaris";
import { PurchaseOrdersPageClient } from "@/components/purchase-orders/purchase-orders-page";

export default function PurchaseOrdersPage() {
  return (
    <Suspense fallback={<Page title="Purchase Orders"><Card><SkeletonBodyText /></Card></Page>}>
      <PurchaseOrdersPageClient />
    </Suspense>
  );
}
