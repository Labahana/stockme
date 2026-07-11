"use client";

import {
  Badge,
  BlockStack,
  Button,
  Card,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/hooks/use-shop";

const features = [
  { title: "Inventory", href: "/app/inventory", detail: "Sync, filters, min/max, barcodes" },
  { title: "Purchase Orders", href: "/app/purchase-orders", detail: "Forecasting, partial receive, invoices" },
  { title: "Stocktakes", href: "/app/stocktakes", detail: "Barcode scan-to-count" },
  { title: "Transfers", href: "/app/transfers", detail: "Multi-location moves" },
  { title: "Suppliers", href: "/app/suppliers", detail: "Vendors, lead times, CSV export" },
  { title: "Reports", href: "/app/reports", detail: "COGS, valuation, totals built-in" },
];

export default function DashboardContent() {
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop") ?? "";
  const qs = shop ? `?shop=${encodeURIComponent(shop)}` : "";
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [hasActivePayment, setHasActivePayment] = useState(false);
  const [billingChecked, setBillingChecked] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const res = await fetch(apiUrl("/api/billing", shop));
    if (!res.ok) {
      setBillingChecked(true);
      return;
    }
    const billing = await res.json();
    setHasActivePayment(Boolean(billing.hasActivePayment));
    setBillingChecked(true);
    if (!billing.hasActivePayment) return;

    const invRes = await fetch(apiUrl("/api/inventory", shop));
    if (!invRes.ok) return;
    const data = await invRes.json();
    setLastSyncedAt(data.store?.lastSyncedAt ?? null);
  }, [shop]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const runInitialSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch(apiUrl("/api/sync/force", shop), { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSyncError(data.error ?? "Sync failed");
        return;
      }
      await loadStatus();
    } catch {
      setSyncError("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const needsOnboarding = billingChecked && hasActivePayment && !lastSyncedAt;

  return (
    <Page title="Stockme" subtitle="Stocky rebuilt — fixed, fast, and $15/month">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Migrating from Stocky?</Text>
              <Text as="p" tone="subdued">
                Import your Stocky purchase order CSVs and supplier spreadsheet in one session.
                Run catalog sync first, then upload.
              </Text>
              <InlineStack gap="200">
                <Button url={`/app/import${qs}`} variant="primary">Import from Stocky</Button>
                <Button url={`/app/inventory${qs}`}>Sync inventory</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {needsOnboarding && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Welcome — sync your catalog</Text>
                <Text as="p" tone="subdued">
                  Run your first inventory sync from Shopify. This pulls products, variants,
                  locations, and stock levels into Stockme.
                </Text>
                {syncError && (
                  <Text as="p" tone="critical">{syncError}</Text>
                )}
                <InlineStack gap="200">
                  <Button variant="primary" loading={syncing} onClick={runInitialSync}>
                    {syncing ? "Syncing…" : "Start catalog sync"}
                  </Button>
                  <Button url={`/app/inventory${qs}`}>Go to inventory</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Stocky is shutting down Aug 31, 2026</Text>
              <Text as="p" tone="subdued">
                Sub-1s inventory loads, webhook sync, barcode generate + scan, partial PO
                invoices per shipment, unlimited CSV export — at $15 / $29 / $39 per month.
              </Text>
              <Badge tone="success">v1.0 — Production ready</Badge>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">Quick actions</Text>
              <InlineStack gap="200">
                <Button url={`/app/reports${qs}`}>Low stock report</Button>
                <Button url={`/app/purchase-orders${qs}`}>Create PO</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, lg: 3 }} gap="400">
            {features.map((f) => (
              <Link key={f.href} href={`${f.href}${qs}`} style={{ textDecoration: "none", color: "inherit" }}>
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingSm">{f.title}</Text>
                    <Text as="p" tone="subdued">{f.detail}</Text>
                  </BlockStack>
                </Card>
              </Link>
            ))}
          </InlineGrid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
