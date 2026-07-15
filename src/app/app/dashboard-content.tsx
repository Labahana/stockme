"use client";

import {
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
import { useCallback, useEffect, useState } from "react";
import { apiUrl, shopFetch } from "@/lib/hooks/use-shop";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LowStockAlert } from "@/components/inventory/LowStockAlert";

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

type Stocktake = {
  id: string;
  name: string;
  status: string;
  locations: { name: string } | { name: string }[];
};

function supplierName(po: PurchaseOrder) {
  const s = po.suppliers;
  if (Array.isArray(s)) return s[0]?.name ?? "—";
  return s?.name ?? "—";
}

function locationName(st: Stocktake) {
  const l = st.locations;
  if (Array.isArray(l)) return l[0]?.name ?? "—";
  return l?.name ?? "—";
}

function StatCard({
  label,
  value,
  sub,
  action,
}: {
  label: string;
  value: string | number;
  sub: string;
  action: { content: string; url: string };
}) {
  return (
    <Card>
      <BlockStack gap="200">
        <Text as="p" tone="subdued" variant="bodySm">
          {label}
        </Text>
        <Text as="p" variant="headingXl">
          {value}
        </Text>
        <Text as="p" tone="subdued" variant="bodySm">
          {sub}
        </Text>
        <Button url={action.url} variant="plain">
          {action.content}
        </Button>
      </BlockStack>
    </Card>
  );
}

export default function DashboardContent() {
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop") ?? "";
  const qs = shop ? `?shop=${encodeURIComponent(shop)}` : "";

  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [lowStock, setLowStock] = useState<InventoryItem[]>([]);
  const [lowCount, setLowCount] = useState(0);
  const [openPos, setOpenPos] = useState<PurchaseOrder[]>([]);
  const [incomingPos, setIncomingPos] = useState(0);
  const [stocktakes, setStocktakes] = useState<Stocktake[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const invRes = await shopFetch("/api/inventory", shop);
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
        const listRes = await shopFetch(`/api/inventory?locationId=${primary.id}&stockStatus=low&limit=10`, shop,
        );
        if (listRes.ok) {
          const list = await listRes.json();
          setLowStock(list.items ?? []);
          setLowCount(list.pagination?.total ?? 0);
        }
      }

      const [poRes, stRes] = await Promise.all([
        shopFetch("/api/purchase-orders", shop),
        shopFetch("/api/stocktakes", shop),
      ]);

      if (poRes.ok) {
        const poData = await poRes.json();
        const orders = (poData.purchaseOrders ?? []) as PurchaseOrder[];
        const open = orders.filter((o) => !["received", "cancelled"].includes(o.status));
        setOpenPos(open.slice(0, 8));
        setIncomingPos(
          orders.filter((o) => ["sent", "partially_received"].includes(o.status)).length,
        );
      }

      if (stRes.ok) {
        const stData = await stRes.json();
        const takes = (stData.stocktakes ?? []) as Stocktake[];
        setStocktakes(takes.filter((t) => t.status === "in_progress").slice(0, 5));
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
      let res = await shopFetch("/api/sync/force", shop, { method: "POST" });
      let data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sync failed");
        return;
      }
      let guard = 0;
      while (data.hasMore && guard < 500) {
        setSyncMessage(data.message ?? "Syncing…");
        res = await shopFetch("/api/sync/force?continue=1", shop, {
          method: "POST",
        });
        data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Sync failed");
          return;
        }
        guard += 1;
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
      title="StockMe"
      subtitle={
        lastSyncedAt
          ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}`
          : "Sync catalog to start managing inventory"
      }
      primaryAction={{
        content: "+ New PO",
        url: `/app/purchase-orders/new${qs}`,
      }}
      secondaryActions={[
        {
          content: syncing ? "Syncing…" : "Sync inventory",
          onAction: runSync,
          loading: syncing,
        },
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
              <p>Pull products, variants, locations, and stock levels — same first step as Stocky.</p>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
            <StatCard
              label="LOW STOCK"
              value={loading ? "—" : lowCount}
              sub="items"
              action={{ content: "View all", url: `/app/reports${qs}` }}
            />
            <StatCard
              label="INCOMING POs"
              value={loading ? "—" : incomingPos}
              sub="shipments"
              action={{ content: "Receive", url: `/app/purchase-orders${qs}` }}
            />
            <StatCard
              label="OPEN POs"
              value={loading ? "—" : openPos.length}
              sub="pending"
              action={{ content: "Manage", url: `/app/purchase-orders${qs}` }}
            />
            <StatCard
              label="LOCATIONS"
              value={loading ? "—" : locations.length}
              sub="active"
              action={{ content: "Inventory", url: `/app/inventory${qs}` }}
            />
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <LowStockAlert
            items={lowStock}
            loading={loading}
            shop={shop}
            onCreatePo={() => {
              window.location.href = `/app/purchase-orders/new${qs}`;
            }}
          />
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card padding="0">
            <div style={{ padding: "16px 20px" }}>
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Recent Purchase Orders
                </Text>
                <Button url={`/app/purchase-orders${qs}`} variant="plain">
                  View all POs
                </Button>
              </InlineStack>
            </div>
            {openPos.length === 0 ? (
              <div style={{ padding: "0 20px 16px" }}>
                <Text as="p" tone="subdued">
                  {loading ? "Loading…" : "No open purchase orders."}
                </Text>
              </div>
            ) : (
              <IndexTable
                resourceName={{ singular: "purchase order", plural: "purchase orders" }}
                itemCount={openPos.length}
                headings={[{ title: "PO #" }, { title: "Vendor" }, { title: "Status" }]}
                selectable={false}
              >
                {openPos.map((po, index) => (
                  <IndexTable.Row id={po.id} key={po.id} position={index}>
                    <IndexTable.Cell>
                      <Button
                        url={`/app/purchase-orders/${po.id}${qs}`}
                        variant="plain"
                      >
                        {po.po_number}
                      </Button>
                    </IndexTable.Cell>
                    <IndexTable.Cell>{supplierName(po)}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <StatusBadge status={po.status} />
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>
            )}
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card padding="0">
            <div style={{ padding: "16px 20px" }}>
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">
                  Pending Stock Takes
                </Text>
                <Button url={`/app/stock-takes${qs}`} variant="plain">
                  Start count
                </Button>
              </InlineStack>
            </div>
            {stocktakes.length === 0 ? (
              <div style={{ padding: "0 20px 16px" }}>
                <Text as="p" tone="subdued">
                  {loading ? "Loading…" : "No stock takes in progress."}
                </Text>
              </div>
            ) : (
              <IndexTable
                resourceName={{ singular: "stock take", plural: "stock takes" }}
                itemCount={stocktakes.length}
                headings={[{ title: "Name" }, { title: "Location" }, { title: "Status" }]}
                selectable={false}
              >
                {stocktakes.map((st, index) => (
                  <IndexTable.Row id={st.id} key={st.id} position={index}>
                    <IndexTable.Cell>{st.name}</IndexTable.Cell>
                    <IndexTable.Cell>{locationName(st)}</IndexTable.Cell>
                    <IndexTable.Cell>
                      <StatusBadge status={st.status} />
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
                Import from Stocky
              </Text>
              <Text as="p" tone="subdued">
                Moving from Stocky? Import your suppliers and PO history in one click.
              </Text>
              <Button url={`/app/import${qs}`} variant="primary">
                Upload Stocky CSVs
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
