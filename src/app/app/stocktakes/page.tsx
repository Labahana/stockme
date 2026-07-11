"use client";

import { Suspense } from "react";
import { Page, Card, SkeletonBodyText } from "@shopify/polaris";
import { StocktakesPageClient } from "@/components/stocktakes/stocktakes-page";

export default function StocktakesPage() {
  return (
    <Suspense fallback={<Page title="Stocktakes"><Card><SkeletonBodyText /></Card></Page>}>
      <StocktakesPageClient />
    </Suspense>
  );
}
