"use client";

import { Suspense } from "react";
import { Page, Card, SkeletonBodyText } from "@shopify/polaris";
import { SettingsPageClient } from "@/components/settings/settings-page";

export default function SettingsPage() {
  return (
    <Suspense fallback={<Page title="Settings"><Card><SkeletonBodyText /></Card></Page>}>
      <SettingsPageClient />
    </Suspense>
  );
}
