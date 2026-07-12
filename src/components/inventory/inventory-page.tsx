"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  ChoiceList,
  Filters,
  IndexTable,
  InlineStack,
  Modal,
  Page,
  Select,
  Text,
  TextField,
  useIndexResourceState,
} from "@shopify/polaris";
import { generateBarcodeValue } from "@/lib/barcodes/generate";
import { renderBarcodeDataUrl } from "@/lib/barcodes/render";
import { usePlanFeatures } from "@/lib/hooks/use-plan";
import { UpgradeBanner } from "@/components/upgrade-banner";
import { InlineEditCell } from "@/components/ui/InlineEditCell";
import { StatusBadge } from "@/components/ui/StatusBadge";

type Location = {
  id: string;
  name: string;
  is_primary: boolean;
};

type InventoryItem = {
  variant_id: string;
  product_id: string;
  product_title: string;
  variant_title: string;
  sku: string | null;
  barcode: string | null;
  vendor: string | null;
  available: number;
  min_stock: number;
  max_stock: number | null;
};

type MetaResponse = {
  store: { shop: string; lastSyncedAt: string | null; planTier: string };
  locations: Location[];
  tags: string[];
  vendors: string[];
};

type ListResponse = {
  items: InventoryItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  store: { shop: string; lastSyncedAt: string | null };
};

type ConsolidatedItem = {
  variant_id: string;
  product_title: string;
  variant_title: string;
  sku: string | null;
  barcode: string | null;
  total_available: number;
  by_location: { location_name: string; available: number }[];
};

const VIEW_OPTIONS = [
  { label: "Single location", value: "location" },
  { label: "All locations", value: "consolidated" },
];

const STOCK_STATUS_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Low stock", value: "low" },
  { label: "Out of stock", value: "out" },
  { label: "In stock", value: "ok" },
];

function formatSyncedAt(value: string | null) {
  if (!value) return "Never synced";
  return new Date(value).toLocaleString();
}

export function InventoryPageClient() {
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop") ?? "";
  const plan = usePlanFeatures();

  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 1,
  });
  const [locationId, setLocationId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [stockStatus, setStockStatus] = useState("all");
  const [tag, setTag] = useState<string | undefined>();
  const [vendor, setVendor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMin, setBulkMin] = useState("0");
  const [bulkMax, setBulkMax] = useState("");
  const [bulkTarget, setBulkTarget] = useState("");
  const [barcodeBusy, setBarcodeBusy] = useState(false);
  const [viewMode, setViewMode] = useState("location");
  const [consolidatedItems, setConsolidatedItems] = useState<ConsolidatedItem[]>([]);
  const [barcodePreview, setBarcodePreview] = useState<string | null>(null);

  const viewOptions = useMemo(
    () =>
      plan.canConsolidatedView
        ? VIEW_OPTIONS
        : VIEW_OPTIONS.filter((o) => o.value !== "consolidated"),
    [plan.canConsolidatedView],
  );

  const apiBase = useMemo(() => {
    const params = new URLSearchParams();
    if (shop) params.set("shop", shop);
    return `/api/inventory?${params.toString()}`;
  }, [shop]);

  const loadMeta = useCallback(async () => {
    const res = await fetch(apiBase);
    if (!res.ok) throw new Error("Failed to load inventory metadata");
    const data = (await res.json()) as MetaResponse;
    setMeta(data);
    if (!locationId && data.locations.length > 0) {
      const primary = data.locations.find((l) => l.is_primary) ?? data.locations[0];
      setLocationId(primary.id);
    }
    return data;
  }, [apiBase, locationId]);

  const loadItems = useCallback(
    async (page = 1) => {
    if (!locationId) return;
    if (viewMode === "consolidated") {
      setLoading(true);
      const params = new URLSearchParams(apiBase.split("?")[1] ?? "");
      params.set("consolidated", "true");
      params.set("page", String(page));
      params.set("limit", "50");
      if (query) params.set("search", query);
      const res = await fetch(`/api/inventory?${params.toString()}`);
      if (!res.ok) {
        setError("Failed to load consolidated inventory");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setConsolidatedItems(data.items ?? []);
      setPagination(data.pagination);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const params = new URLSearchParams(apiBase.split("?")[1] ?? "");
    params.set("locationId", locationId);
    params.set("page", String(page));
    params.set("limit", "50");
    if (query) params.set("search", query);
    if (stockStatus !== "all") params.set("stockStatus", stockStatus);
    if (tag) params.set("tag", tag);
    if (vendor) params.set("vendor", vendor);

    const res = await fetch(`/api/inventory?${params.toString()}`);
    if (!res.ok) {
      setError("Failed to load inventory");
      setLoading(false);
      return;
    }

    const data = (await res.json()) as ListResponse;
    setItems(data.items);
    setPagination(data.pagination);
    setMeta((prev) =>
      prev && prev.store.lastSyncedAt !== data.store.lastSyncedAt
        ? { ...prev, store: { ...prev.store, lastSyncedAt: data.store.lastSyncedAt } }
        : prev,
    );
    setLoading(false);
  },
    [apiBase, locationId, query, stockStatus, tag, vendor, viewMode],
  );

  useEffect(() => {
    if (!plan.canConsolidatedView && viewMode === "consolidated") {
      setViewMode("location");
    }
  }, [plan.canConsolidatedView, viewMode]);

  // Debounce search so typing doesn't hammer the RPC on every keystroke
  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (search !== query) setQuery(search);
    }, 350);
    return () => window.clearTimeout(handle);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional: only re-run on search typing

  useEffect(() => {
    loadMeta().catch(() => setError("Failed to load store data"));
  }, [loadMeta]);

  useEffect(() => {
    if (viewMode === "consolidated" || locationId) loadItems(1);
  }, [locationId, query, stockStatus, tag, vendor, loadItems, viewMode]);

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(items as unknown as { [key: string]: unknown }[], {
      resourceIDResolver: (item) => (item as unknown as InventoryItem).variant_id,
    });

  const forceSync = async () => {
    setSyncing(true);
    setError(null);
    setSyncMessage(null);
    try {
      const params = new URLSearchParams();
      if (shop) params.set("shop", shop);
      const res = await fetch(`/api/sync/force?${params.toString()}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sync failed");
        return;
      }
      setSyncMessage(data.message ?? "Sync complete");
      await loadMeta();
      await loadItems(pagination.page);
    } catch {
      setError("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const saveThreshold = async (
    variantId: string,
    field: "minStock" | "maxStock",
    raw: string,
  ) => {
    const params = new URLSearchParams();
    if (shop) params.set("shop", shop);
    const body: Record<string, unknown> = {
      variantIds: [variantId],
      locationId,
    };
    if (field === "minStock") {
      body.minStock = Math.max(0, Number(raw) || 0);
    } else {
      body.maxStock = raw.trim() === "" ? null : Math.max(0, Number(raw) || 0);
    }
    const res = await fetch(`/api/inventory/bulk?${params.toString()}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      setError("Could not save threshold");
      return;
    }
    setItems((prev) =>
      prev.map((item) => {
        if (item.variant_id !== variantId) return item;
        if (field === "minStock") {
          return { ...item, min_stock: Math.max(0, Number(raw) || 0) };
        }
        return {
          ...item,
          max_stock: raw.trim() === "" ? null : Math.max(0, Number(raw) || 0),
        };
      }),
    );
  };

  const applyBulkThresholds = async () => {
    const params = new URLSearchParams();
    if (shop) params.set("shop", shop);

    const res = await fetch(`/api/inventory/bulk?${params.toString()}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variantIds: selectedResources,
        locationId,
        minStock: Number(bulkMin),
        maxStock: bulkMax === "" ? null : Number(bulkMax),
        targetStock: bulkTarget === "" ? undefined : Number(bulkTarget),
      }),
    });

    if (!res.ok) {
      setError("Bulk update failed");
      return;
    }

    setBulkOpen(false);
    await loadItems(pagination.page);
  };

  const assignBarcodes = async (variantIds: string[]) => {
    if (variantIds.length === 0) return;
    setBarcodeBusy(true);
    setError(null);
    let successCount = 0;
    let firstError: string | null = null;
    try {
      const params = new URLSearchParams();
      if (shop) params.set("shop", shop);

      for (const variantId of variantIds) {
        const item = items.find((i) => i.variant_id === variantId);
        if (item?.barcode) {
          successCount += 1;
          continue;
        }

        const barcode = generateBarcodeValue(variantId);
        const res = await fetch(`/api/barcodes?${params.toString()}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variantId, barcode }),
        });
        if (!res.ok) {
          if (!firstError) firstError = "Some barcodes could not be assigned";
          continue;
        }
        successCount += 1;
        if (!item?.barcode) {
          setBarcodePreview(renderBarcodeDataUrl(barcode));
        }
      }
      if (firstError && successCount === 0) {
        setError(firstError);
      } else if (firstError) {
        setError(`${firstError} (${successCount}/${variantIds.length} succeeded)`);
      }
      await loadItems(pagination.page);
    } catch {
      setError("Failed to generate barcodes");
    } finally {
      setBarcodeBusy(false);
    }
  };

  const rowMarkup = items.map((item, index) => (
    <IndexTable.Row
      id={item.variant_id}
      key={item.variant_id}
      selected={selectedResources.includes(item.variant_id)}
      position={index}
    >
      <IndexTable.Cell>
        <BlockStack gap="100">
          <Text as="span" variant="bodyMd" fontWeight="semibold">
            {item.product_title}
          </Text>
          {item.variant_title !== "Default Title" && (
            <Text as="span" tone="subdued" variant="bodySm">
              {item.variant_title}
            </Text>
          )}
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>{item.sku ?? "—"}</IndexTable.Cell>
      <IndexTable.Cell>{item.barcode ?? "—"}</IndexTable.Cell>
      <IndexTable.Cell>
        <StatusBadge
          status={
            item.available <= 0
              ? "out"
              : item.min_stock > 0 && item.available < item.min_stock
                ? "low"
                : "ok"
          }
          label={String(item.available)}
        />
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineEditCell
          value={item.min_stock}
          type="number"
          min={0}
          onSave={(next) => saveThreshold(item.variant_id, "minStock", next)}
        />
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineEditCell
          value={item.max_stock}
          type="number"
          min={0}
          placeholder="—"
          onSave={(next) => saveThreshold(item.variant_id, "maxStock", next)}
        />
      </IndexTable.Cell>
      <IndexTable.Cell>{item.vendor ?? "—"}</IndexTable.Cell>
    </IndexTable.Row>
  ));

  const filters = [
    {
      key: "stockStatus",
      label: "Stock status",
      filter: (
        <ChoiceList
          title="Stock status"
          titleHidden
          choices={STOCK_STATUS_OPTIONS}
          selected={[stockStatus]}
          onChange={(value) => setStockStatus(value[0] ?? "all")}
        />
      ),
      shortcut: true,
    },
  ];

  if (tag) {
    filters.push({
      key: "tag",
      label: "Tag",
      filter: <Text as="span">{tag}</Text>,
      shortcut: true,
    });
  }

  if (vendor) {
    filters.push({
      key: "vendor",
      label: "Vendor",
      filter: <Text as="span">{vendor}</Text>,
      shortcut: true,
    });
  }

  return (
    <Page
      title="Inventory"
      primaryAction={{
        content: syncing ? "Syncing…" : "Sync inventory",
        onAction: forceSync,
        loading: syncing,
      }}
      secondaryActions={[
        {
          content: "Export CSV",
          url:
            locationId && shop
              ? `/api/inventory?shop=${encodeURIComponent(shop)}&locationId=${locationId}&export=csv`
              : undefined,
          disabled: !locationId,
        },
      ]}
      subtitle={`Last synced: ${formatSyncedAt(meta?.store.lastSyncedAt ?? null)}`}
    >
      <BlockStack gap="400">
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

        {!plan.loading && !plan.canConsolidatedView && (
          <UpgradeBanner
            planTier={plan.planTier}
            feature="Cross-location inventory view"
            shop={shop}
          />
        )}

        <Card>
          <InlineStack gap="300" wrap>
            <Box minWidth="200px">
              <Select
                label="View"
                options={viewOptions}
                value={viewMode}
                onChange={setViewMode}
              />
            </Box>
            {viewMode === "location" && (
            <Box minWidth="200px">
              <Select
                label="Location"
                options={(meta?.locations ?? []).map((l) => ({
                  label: l.name,
                  value: l.id,
                }))}
                value={locationId}
                onChange={setLocationId}
              />
            </Box>
            )}
            {meta?.vendors && meta.vendors.length > 0 && viewMode === "location" && (
              <Box minWidth="200px">
                <Select
                  label="Vendor"
                  options={[
                    { label: "All vendors", value: "" },
                    ...meta.vendors.map((v) => ({ label: v, value: v })),
                  ]}
                  value={vendor ?? ""}
                  onChange={(value) => setVendor(value || undefined)}
                />
              </Box>
            )}
            {meta?.tags && meta.tags.length > 0 && viewMode === "location" && (
              <Box minWidth="200px">
                <Select
                  label="Tag"
                  options={[
                    { label: "All tags", value: "" },
                    ...meta.tags.map((t) => ({ label: t, value: t })),
                  ]}
                  value={tag ?? ""}
                  onChange={(value) => setTag(value || undefined)}
                />
              </Box>
            )}
          </InlineStack>
        </Card>

        <Card padding="0">
          <Filters
            queryValue={search}
            filters={filters}
            appliedFilters={[
              ...(stockStatus !== "all"
                ? [
                    {
                      key: "stockStatus",
                      label: `Status: ${
                        STOCK_STATUS_OPTIONS.find((o) => o.value === stockStatus)?.label
                      }`,
                      onRemove: () => setStockStatus("all"),
                    },
                  ]
                : []),
              ...(tag
                ? [{ key: "tag", label: `Tag: ${tag}`, onRemove: () => setTag(undefined) }]
                : []),
              ...(vendor
                ? [{ key: "vendor", label: `Vendor: ${vendor}`, onRemove: () => setVendor(undefined) }]
                : []),
            ]}
            onQueryChange={(value) => {
              setSearch(value);
            }}
            onQueryClear={() => {
              setSearch("");
              setQuery("");
            }}
            onClearAll={() => {
              setSearch("");
              setQuery("");
              setStockStatus("all");
              setTag(undefined);
              setVendor(undefined);
            }}
            queryPlaceholder="Search SKU, barcode, or title"
          />
          <Box padding="300">
            <Button onClick={() => setQuery(search)}>Search</Button>
          </Box>

          <IndexTable
            resourceName={{ singular: "item", plural: "items" }}
            itemCount={pagination.total}
            selectedItemsCount={
              viewMode === "location"
                ? allResourcesSelected
                  ? "All"
                  : selectedResources.length
                : undefined
            }
            onSelectionChange={viewMode === "location" ? handleSelectionChange : undefined}
            headings={
              viewMode === "consolidated"
                ? [
                    { title: "Product" },
                    { title: "SKU" },
                    { title: "Total" },
                    { title: "By location" },
                  ]
                : [
                    { title: "Product" },
                    { title: "SKU" },
                    { title: "Barcode" },
                    { title: "Available" },
                    { title: "Min" },
                    { title: "Max" },
                    { title: "Vendor" },
                  ]
            }
            loading={loading}
            bulkActions={
              viewMode === "location"
                ? [
                    { content: "Set min/max", onAction: () => setBulkOpen(true) },
                    {
                      content: barcodeBusy ? "Generating…" : "Generate barcodes",
                      onAction: () => assignBarcodes(selectedResources),
                    },
                  ]
                : undefined
            }
            pagination={{
              hasNext: pagination.page < pagination.totalPages,
              hasPrevious: pagination.page > 1,
              onNext: () => loadItems(pagination.page + 1),
              onPrevious: () => loadItems(pagination.page - 1),
            }}
          >
            {viewMode === "consolidated"
              ? consolidatedItems.map((item, index) => (
                  <IndexTable.Row id={item.variant_id} key={item.variant_id} position={index}>
                    <IndexTable.Cell>
                      {item.product_title}
                      {item.variant_title !== "Default Title" ? ` / ${item.variant_title}` : ""}
                    </IndexTable.Cell>
                    <IndexTable.Cell>{item.sku ?? "—"}</IndexTable.Cell>
                    <IndexTable.Cell>{item.total_available}</IndexTable.Cell>
                    <IndexTable.Cell>
                      {item.by_location.map((l) => `${l.location_name}: ${l.available}`).join(" · ")}
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))
              : rowMarkup}
          </IndexTable>
        </Card>
      </BlockStack>

      <Modal
        open={bulkOpen}
        onClose={() => {
          setBulkOpen(false);
          setBulkMin("0");
          setBulkMax("");
          setBulkTarget("");
        }}
        title="Set min/max thresholds"
        primaryAction={{
          content: "Apply",
          onAction: applyBulkThresholds,
        }}
        secondaryActions={[{ content: "Cancel", onAction: () => {
          setBulkOpen(false);
          setBulkMin("0");
          setBulkMax("");
          setBulkTarget("");
        } }]}
      >
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p" tone="subdued">
              Update {selectedResources.length} selected variant
              {selectedResources.length === 1 ? "" : "s"} at this location.
            </Text>
            <TextField
              label="Minimum stock (reorder point)"
              type="number"
              value={bulkMin}
              onChange={setBulkMin}
              autoComplete="off"
            />
            <TextField
              label="Maximum stock (optional)"
              type="number"
              value={bulkMax}
              onChange={setBulkMax}
              autoComplete="off"
            />
            <TextField
              label="Target stock (fill shelves / target level)"
              type="number"
              value={bulkTarget}
              onChange={setBulkTarget}
              autoComplete="off"
            />
          </BlockStack>
        </Modal.Section>
      </Modal>

      <Modal open={Boolean(barcodePreview)} onClose={() => setBarcodePreview(null)} title="Barcode generated">
        <Modal.Section>
          {barcodePreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={barcodePreview} alt="Generated barcode" style={{ maxWidth: "100%" }} />
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}
