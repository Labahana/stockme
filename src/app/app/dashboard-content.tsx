"use client";

import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Card,
  IndexTable,
  InlineGrid,
  InlineStack,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { apiUrl } from "@/lib/hooks/use-shop";

type Location = { id: string; name: string; is_primary: boolean };

type InventoryItem = {
  variant_id: string;
  product_title: string;
  variant_title: string;
  sku: string | null;
  available: number;
  min_stock: number;
};

type PurchaseOrder = {
  id: string;
  po_number: string;
  status: string;
  suppliers: { name: string } | { name: string }[];
};

function supplierName(po: PurchaseOrder) {
  const s = po.suppliers;
  if (Array.isArray(s)) return s[0]?.name ?? "—";
  return s?.name ?? "—";
}

function statusTone(status: string): "success" | "attention" | "info" | "warning" | undefined {
  switch (status) {
    case "received":
      return "success";
    case "sent":
    case "partially_received":
      return "attention";
    case "draft":
      return "info";
    default:
      return undefined;
  }
}

export default function DashboardContent() {
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop") ?? "";
  const qs = shop ? `?shop=${encodeURIComponent(shop)}` : "";

  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);
  const [openPos, setOpenPos] = useState<PurchaseOrder[]>([]);
  const [skuCount, setSkuCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const invRes = await fetch(apiUrl("/api/inventory", shop));
      if (!invRes.ok) {
        setError("Could not load inventory. Sync your catalog to get started.");
        setLoading(false);
        return;
      }
      const inv = await invRes.json();
      setLastSyncedAt(inv.store?.lastSyncedAt ?? null);
      setLocations(inv.locations ?? []);

      const primary =
        (inv.locations as Location[] | undefined)?.find((l) => l.is_primary) ??
        (inv.locations as Location[] | undefined)?.[0];

      if (primary?.id) {
        const listRes = await fetch(
          apiUrl(`/api/inventory?locationId=${primary.id}&stockStatus=low&limit=10`, shop),
        );
        if (listRes.ok) {
          const list = await listRes.json();
          setLowStock(list.items ?? []);
          setSkuCount(list.pagination?.total ?? 0);
        }
      }

      const poRes = await fetch(apiUrl("/api/purchase-orders", shop));
      if (poRes.ok) {
        const poData = await poRes.json();
        const orders = (poData.purchaseOrders ?? []) as PurchaseOrder[];
        setOpenPos(
          orders
            .filter((o) => !["received", "cancelled"].includes(o.status))
            .slice(0, 8),
        );
      }
    } catch {
      setError("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const runSync = async () => {
    setSyncing(true);
    setError(null);
    setSyncMessage(null);
    try {
      const res = await fetch(apiUrl("/api/sync/force", shop), { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sync failed");
        return;
      }
      setSyncMessage(data.message ?? "Sync complete");
      await loadStatus();
    } catch {
      setError("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const needsSync = !loading && !lastSyncedAt;

  return (
    <Page
      title="Home"
      subtitle={
        lastSyncedAt
          ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}`
          : "Sync catalog to start managing inventory"
      }
      primaryAction={{
        content: syncing ? "Syncing…" : "Sync inventory",
        onAction: runSync,
        loading: syncing,
      }}
      secondaryActions={[
        { content: "Create purchase order", url: `/app/purchase-orders${qs}` },
        { content: "Start stocktake", url: `/app/stocktakes${qs}` },
      ]}
    >
      <Layout>
        {(error || syncMessage) && (
          <Layout.Section>
            {error && (
              <Banner tone="critical" onDismiss={() => setError(null)}>
                {error}
              </Banner>
            )}
            {syncMessage && (
              <Banner tone="success" onDismiss={() => setSyncMessage(null)}>
                {syncMessage}
              </Banner>
            )}
          </Layout.Section>
        )}

        {needsSync && (
          <Layout.Section>
            <Banner
              title="Sync your Shopify catalog"
              tone="warning"
              action={{ content: syncing ? "Syncing…" : "Sync now", onAction: runSync }}
            >
              <p>
                Pull products, variants, locations, and stock levels from Shopify — the same
                first step as Stocky after install.
              </p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 3 }} gap="400">
            <Card>
              <BlockStack gap="100">
                <Text as="p" tone="subdued" variant="bodySm">
                  Locations
                </Text>
                <Text as="p" variant="headingLg">
                  {locations.length}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="100">
                <Text as="p" tone="subdued" variant="bodySm">
                  Low stock variants
                </Text>
                <Text as="p" variant="headingLg">
                  {loading ? "—" : skuCount}
                </Text>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="100">
                <Text as="p" tone="subdued" variant="bodySm">
                  Open purchase orders
                </Text>
                <Text as="p" variant="headingLg">
                  {loading ? "—" : openPos.length}
                </Text>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <Card padding="0">
            <BoxPad>
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Low stock
                </Text>
                <Button url={`/app/reports${qs}`} variant="plain">
                  View low stock report
                </Button>
              </InlineStack>
            </BoxPad>
            {lowStock.length === 0 ? (
              <BoxPad>
                <Text as="p" tone="subdued">
                  {loading ? "Loading…" : "No low-stock variants at your primary location."}
                </Text>
              </BoxPad>
            ) : (
              <IndexTable
                resourceName={{ singular: "variant", plural: "variants" }}
                itemCount={lowStock.length}
                headings={[
                  { title: "Product" },
                  { title: "SKU" },
                  { title: "Available" },
                  { title: "Min" },
                ]}
                selectable={false}
              >
                {lowStock.map((item, index) => (
                  <IndexTable.Row id={item.variant_id} key={item.variant_id} position={index}>
                    <IndexTable.Cell>
                      <Text as="span" fontWeight="semibold">
                        {item.product_title}
                      </Text>
                      {item.variant_title && item.variant_title !== "Default Title" && (
                        <Text as="span" tone="subdued">
                          {" "}
                          · {item.variant_title}
                        </Text>
                      )}
                    </IndexTable.Cell>
                    <IndexTable.Cell>{item.sku ?? "—"}</IndexTable.Cell>
                    <IndexTable.Cell>{item.available}</IndexTable.Cell>
                    <IndexTable.Cell>{item.min_stock}</IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card padding="0">
            <BoxPad>
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Purchase orders
                </Text>
                <Button url={`/app/purchase-orders${qs}`} variant="plain">
                  View all
                </Button>
              </InlineStack>
            </BoxPad>
            {openPos.length === 0 ? (
              <BoxPad>
                <Text as="p" tone="subdued">
                  {loading
                    ? "Loading…"
                    : "No open purchase orders. Create one from Purchases."}
                </Text>
              </BoxPad>
            ) : (
              <IndexTable
                resourceName={{ singular: "purchase order", plural: "purchase orders" }}
                itemCount={openPos.length}
                headings={[
                  { title: "PO" },
                  { title: "Supplier" },
                  { title: "Status" },
                ]}
                selectable={false}
              >
                {openPos.map((po, index) => (
                  <IndexTable.Row id={po.id} key={po.id} position={index}>
                    <IndexTable.Cell>
                      <Text as="span" fontWeight="semibold">
                        {po.po_number}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>{supplierName(po)}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <Badge tone={statusTone(po.status)}>{po.status.replace(/_/g, " ")}</Badge>
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Quick links
              </Text>
              <InlineStack gap="200" wrap>
                <Button url={`/app/inventory${qs}`}>Inventory</Button>
                <Button url={`/app/purchase-orders${qs}`}>Purchases</Button>
                <Button url={`/app/stocktakes${qs}`}>Stocktakes</Button>
                <Button url={`/app/transfers${qs}`}>Transfers</Button>
                <Button url={`/app/suppliers${qs}`}>Suppliers</Button>
                <Button url={`/app/import${qs}`}>Import from Stocky</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function BoxPad({ children }: { children: ReactNode }) {
  return <div style={{ padding: "16px 20px" }}>{children}</div>;
}
