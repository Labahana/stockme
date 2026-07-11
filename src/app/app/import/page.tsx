"use client";

import { Suspense } from "react";
import { Page, Card, SkeletonBodyText } from "@shopify/polaris";
import { StockyImportPageClient } from "@/components/import/stocky-import-page";

export default function ImportPage() {
  return (
    <Suspense
      fallback={
        <Page title="Import from Stocky">
          <Card>
            <SkeletonBodyText lines={4} />
          </Card>
        </Page>
      }
    >
      <StockyImportPageClient />
    </Suspense>
  );
}
