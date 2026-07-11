"use client";

import { Suspense } from "react";
import { Page, Card, SkeletonBodyText } from "@shopify/polaris";
import { SuppliersPageClient } from "@/components/suppliers/suppliers-page";

export default function SuppliersPage() {
  return (
    <Suspense fallback={<Page title="Suppliers"><Card><SkeletonBodyText /></Card></Page>}>
      <SuppliersPageClient />
    </Suspense>
  );
}
