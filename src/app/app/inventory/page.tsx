"use client";

import { Suspense } from "react";
import { Card, Page, SkeletonBodyText } from "@shopify/polaris";
import { InventoryPageClient } from "@/components/inventory/inventory-page";

function InventoryFallback() {
  return (
    <Page title="Inventory">
      <Card>
        <SkeletonBodyText lines={6} />
      </Card>
    </Page>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<InventoryFallback />}>
      <InventoryPageClient />
    </Suspense>
  );
}
