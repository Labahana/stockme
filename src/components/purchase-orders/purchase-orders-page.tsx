"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  ChoiceList,
  DataTable,
  FormLayout,
  IndexTable,
  InlineStack,
  Modal,
  Page,
  Select,
  Text,
  TextField,
  useIndexResourceState,
} from "@shopify/polaris";
import { FORECAST_METHODS, PLAN_TIERS } from "@/lib/constants";
import { downloadPurchaseOrderPdf } from "@/lib/export/po-pdf";
import { apiUrl, useShop, shopFetch } from "@/lib/hooks/use-shop";
import { usePlanFeatures } from "@/lib/hooks/use-plan";
import { BarcodeScanner } from "@/components/barcode-scanner";
import { StatusBadge } from "@/components/ui/StatusBadge";

type PO = {
  id: string;
  po_number: string;
  status: string;
  suppliers: { name: string } | { name: string }[];
  locations: { name: string } | { name: string }[];
  po_line_items: {
    id: string;
    ordered_qty: number;
    received_qty: number;
    variants: { sku: string; title: string; barcode?: string } | { sku: string; title: string; barcode?: string }[];
  }[];
};

type ForecastLine = {
  variantId: string;
  sku: string | null;
  title: string;
  available: number;
  reorderQty: number;
};

export function PurchaseOrdersPageClient() {
  const shop = useShop();
  const searchParams = useSearchParams();
  const plan = usePlanFeatures();
  const [orders, setOrders] = useState<PO[]>([]);
  const [poPage, setPoPage] = useState(1);
  const [poTotalPages, setPoTotalPages] = useState(1);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [selectedPo, setSelectedPo] = useState<PO | null>(null);
  const [forecastLines, setForecastLines] = useState<ForecastLine[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [method, setMethod] = useState<string[]>(["last_x_days"]);
  const [days, setDays] = useState("30");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [targetStock, setTargetStock] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({});
  const [scanQty, setScanQty] = useState("1");
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [forecastPage, setForecastPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const forecastPageSize = 50;
  const forecastMethodChoices = FORECAST_METHODS.filter(
    (fm) => plan.canAdvancedForecast || fm === "last_x_days",
  );

  const load = useCallback(async (page = poPage) => {
    setLoading(true);
    setError(null);
    try {
      const [poRes, supRes, invRes] = await Promise.all([
        shopFetch(`/api/purchase-orders?page=${page}&limit=50`, shop),
        shopFetch("/api/suppliers", shop),
        shopFetch("/api/inventory", shop),
      ]);

      if (!poRes.ok || !supRes.ok || !invRes.ok) {
        setError("Failed to load purchase orders data");
        setLoading(false);
        return;
      }

      const poData = await poRes.json();
      const supData = await supRes.json();
      const invData = await invRes.json();
      setOrders(poData.purchaseOrders ?? []);
      setPoPage(poData.pagination?.page ?? page);
      setPoTotalPages(poData.pagination?.totalPages ?? 1);
      setSuppliers((supData.suppliers ?? []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
      setLocations(invData.locations ?? []);
      setLocationId((prev) => prev || (invData.locations?.[0]?.id ?? ""));
    } catch {
      setError("Failed to load purchase orders data");
    } finally {
      setLoading(false);
    }
  }, [shop, poPage]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setCreateOpen(true);
    }
  }, [searchParams]);

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(orders as unknown as { [key: string]: unknown }[], {
      resourceIDResolver: (r) => (r as unknown as PO).id,
    });

  const runForecast = async () => {
    if (!locationId) {
      setError("Select a location before running a forecast");
      return;
    }
    setError(null);
    const res = await shopFetch("/api/purchase-orders", shop, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "forecast",
        supplierId: supplierId || null,
        locationId,
        method: method[0],
        days: Number(days),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        targetStock: targetStock ? Number(targetStock) : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Forecast failed");
      return;
    }
    setForecastLines(data.lines ?? []);
    setForecastPage(1);
  };

  const createPo = async () => {
    const lines = forecastLines
      .filter((l) => l.reorderQty > 0)
      .map((l) => ({ variantId: l.variantId, orderedQty: l.reorderQty, unitCost: 0 }));
    if (!supplierId || !locationId || lines.length === 0) {
      setError("Select supplier, location, and run forecast first");
      return;
    }
    const res = await shopFetch("/api/purchase-orders", shop, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId,
        locationId,
        forecastMethod: method[0],
        lines,
      }),
    });
    if (!res.ok) {
      setError("Failed to create PO");
      return;
    }
    setCreateOpen(false);
    load();
  };

  const downloadPdf = async (id: string) => {
    const res = await shopFetch(`/api/purchase-orders/${id}`, shop);
    if (!res.ok) {
      setError("Failed to load PO for PDF");
      return;
    }
    const data = await res.json();
    if (data.purchaseOrder) downloadPurchaseOrderPdf(data.purchaseOrder);
  };

  const sendPo = async (id: string) => {
    const res = await shopFetch(`/api/purchase-orders/${id}`, shop, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to send PO");
      return false;
    }
    return true;
  };

  const bulkSend = async () => {
    let failures = 0;
    for (const id of selectedResources) {
      const po = orders.find((o) => o.id === id);
      if (po?.status === "draft") {
        const ok = await sendPo(id);
        if (!ok) failures += 1;
      }
    }
    if (failures > 0) {
      setError(`${failures} PO(s) could not be sent`);
    }
    load();
  };

  const bulkExportPdf = async () => {
    for (const id of selectedResources) {
      await downloadPdf(id);
    }
  };

  const receivePo = async () => {
    if (!selectedPo) return;
    const lines = (selectedPo.po_line_items ?? [])
      .map((l) => ({
        poLineItemId: l.id,
        quantity: Number(receiveQtys[l.id] ?? 0),
      }))
      .filter((l) => l.quantity > 0);

    if (lines.length === 0) {
      setError("Enter at least one received quantity");
      return;
    }

    const res = await shopFetch(`/api/purchase-orders/${selectedPo.id}`, shop, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "receive",
        lines,
        invoice: {
          invoiceNumber: invoiceNumber || undefined,
          invoiceAmount: invoiceAmount ? Number(invoiceAmount) : undefined,
        },
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Receive failed");
      return;
    }
    closeReceiveModal();
    load();
  };

  const closeReceiveModal = () => {
    setReceiveOpen(false);
    setSelectedPo(null);
    setReceiveQtys({});
    setInvoiceNumber("");
    setInvoiceAmount("");
    setLastScan(null);
    setScanQty("1");
  };

  const handleScanReceive = async (barcode: string) => {
    if (!selectedPo) return;
    const res = await shopFetch(`/api/purchase-orders/${selectedPo.id}`, shop, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "scan", barcode, quantity: Number(scanQty) || 1 }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Scan failed");
      return;
    }
    setLastScan(`${data.variant?.sku ?? data.variant?.title} +${data.scanQty}`);
    setReceiveQtys({
      ...receiveQtys,
      [data.poLineItemId]: String(
        Number(receiveQtys[data.poLineItemId] ?? 0) + Number(data.scanQty),
      ),
    });
  };

  const m = method[0];
  const showDays = m === "last_x_days" || m === "same_period_last_year";
  const showRange = m === "custom_range";
  const showTarget = m === "target_stock_level";

  const reorderLines = forecastLines.filter((l) => l.reorderQty > 0);
  const forecastTotalPages = Math.ceil(reorderLines.length / forecastPageSize) || 1;
  const forecastPreview = reorderLines
    .slice((forecastPage - 1) * forecastPageSize, forecastPage * forecastPageSize)
    .map((l) => [l.sku ?? "—", l.title, String(l.available), String(l.reorderQty)]);

  const rows = orders.map((po, i) => {
    const supplier = Array.isArray(po.suppliers) ? po.suppliers[0] : po.suppliers;
    const location = Array.isArray(po.locations) ? po.locations[0] : po.locations;
    return (
      <IndexTable.Row
        id={po.id}
        key={po.id}
        position={i}
        selected={selectedResources.includes(po.id)}
      >
        <IndexTable.Cell>
          <Button url={`/app/purchase-orders/${po.id}${shop ? `?shop=${encodeURIComponent(shop)}` : ""}`} variant="plain">
            {po.po_number}
          </Button>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <StatusBadge status={po.status} />
        </IndexTable.Cell>
        <IndexTable.Cell>{supplier?.name ?? "—"}</IndexTable.Cell>
        <IndexTable.Cell>{location?.name ?? "—"}</IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200">
            <Button size="slim" onClick={() => downloadPdf(po.id)}>PDF</Button>
            {po.status === "draft" && (
              <Button
                size="slim"
                onClick={async () => {
                  const ok = await sendPo(po.id);
                  if (ok) load();
                }}
              >
                Send
              </Button>
            )}
            {(po.status === "sent" || po.status === "partially_received") && (
              <Button
                size="slim"
                onClick={() => {
                  setSelectedPo(po);
                  setReceiveOpen(true);
                  setReceiveQtys({});
                  setLastScan(null);
                }}
              >
                Receive
              </Button>
            )}
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title="Purchase Orders"
      primaryAction={{ content: "+ Create Purchase Order", onAction: () => setCreateOpen(true) }}
      secondaryActions={[
        { content: "Export CSV", url: apiUrl("/api/purchase-orders?export=csv", shop) },
        {
          content: "Force resync",
          onAction: async () => {
            try {
              let res = await shopFetch("/api/sync/force", shop, { method: "POST" });
              let data = await res.json().catch(() => ({} as { error?: string; hasMore?: boolean }));
              if (!res.ok) {
                setError(data.error ?? `Sync failed (${res.status})`);
                return;
              }
              let guard = 0;
              while (data.hasMore && guard < 500) {
                res = await shopFetch("/api/sync/force?continue=1", shop, {
                  method: "POST",
                });
                data = await res.json().catch(() => ({} as { error?: string; hasMore?: boolean }));
                if (!res.ok) {
                  setError(data.error ?? `Sync failed (${res.status})`);
                  return;
                }
                guard += 1;
              }
              load();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Sync failed");
            }
          },
        },
      ]}
    >
      <BlockStack gap="400">
        {error && <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>}
        <Card padding="0">
          <IndexTable
            resourceName={{ singular: "PO", plural: "POs" }}
            itemCount={orders.length}
            selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
            onSelectionChange={handleSelectionChange}
            headings={[
              { title: "PO #" },
              { title: "Status" },
              { title: "Supplier" },
              { title: "Location" },
              { title: "Actions" },
            ]}
            loading={loading}
            bulkActions={[
              { content: "Send selected", onAction: bulkSend },
              { content: "Download PDFs", onAction: bulkExportPdf },
            ]}
            pagination={{
              hasNext: poPage < poTotalPages,
              hasPrevious: poPage > 1,
              onNext: () => void load(poPage + 1),
              onPrevious: () => void load(poPage - 1),
            }}
          >
            {rows}
          </IndexTable>
        </Card>
      </BlockStack>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create purchase order"
        size="large"
        primaryAction={{ content: "Create", onAction: createPo }}
        secondaryActions={[{ content: "Cancel", onAction: () => setCreateOpen(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <Select
              label="Supplier"
              options={[{ label: "Select", value: "" }, ...suppliers.map((s) => ({ label: s.name, value: s.id }))]}
              value={supplierId}
              onChange={setSupplierId}
            />
            <Select
              label="Location"
              options={locations.map((l) => ({ label: l.name, value: l.id }))}
              value={locationId}
              onChange={setLocationId}
            />
            <ChoiceList
              title="Forecast method"
              choices={forecastMethodChoices.map((fm) => ({
                label: fm.replace(/_/g, " "),
                value: fm,
              }))}
              selected={method}
              onChange={setMethod}
            />
            {showDays && (
              <TextField label="Days" type="number" value={days} onChange={setDays} autoComplete="off" />
            )}
            {showRange && (
              <>
                <TextField label="Start date" type="date" value={startDate} onChange={setStartDate} autoComplete="off" />
                <TextField label="End date" type="date" value={endDate} onChange={setEndDate} autoComplete="off" />
              </>
            )}
            {showTarget && (
              <TextField
                label="Target stock level"
                type="number"
                value={targetStock}
                onChange={setTargetStock}
                autoComplete="off"
              />
            )}
            <Button onClick={runForecast}>Run forecast</Button>
            {forecastLines.length > 0 && (
              <Text as="p">
                {reorderLines.length} lines suggested
              </Text>
            )}
            {forecastPreview.length > 0 && (
              <>
                <DataTable
                  columnContentTypes={["text", "text", "numeric", "numeric"]}
                  headings={["SKU", "Variant", "Available", "Reorder"]}
                  rows={forecastPreview}
                />
                {forecastTotalPages > 1 && (
                  <InlineStack gap="200" align="center">
                    <Button
                      disabled={forecastPage <= 1}
                      onClick={() => setForecastPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Text as="span" tone="subdued">
                      Page {forecastPage} of {forecastTotalPages}
                    </Text>
                    <Button
                      disabled={forecastPage >= forecastTotalPages}
                      onClick={() => setForecastPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </InlineStack>
                )}
              </>
            )}
          </FormLayout>
        </Modal.Section>
      </Modal>

      <Modal
        open={receiveOpen}
        onClose={closeReceiveModal}
        title="Receive shipment"
        size="large"
        primaryAction={{ content: "Record receipt", onAction: receivePo }}
        secondaryActions={[{ content: "Cancel", onAction: closeReceiveModal }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            {plan.canPartialInvoice && (
              <FormLayout>
                <TextField label="Invoice #" value={invoiceNumber} onChange={setInvoiceNumber} autoComplete="off" />
                <TextField label="Invoice amount" value={invoiceAmount} onChange={setInvoiceAmount} autoComplete="off" />
              </FormLayout>
            )}
            {!plan.canPartialInvoice && (
              <Banner tone="info">
                Invoice capture is available on the {PLAN_TIERS.pro.name} plan.
              </Banner>
            )}
            <Text as="p" tone="subdued">
              Point the camera at a product barcode, or enter quantities below. Each scan adds the
              scan quantity to the matching line.
            </Text>
            <TextField label="Scan quantity" type="number" value={scanQty} onChange={setScanQty} autoComplete="off" />
            <BarcodeScanner elementId="po-receive-scanner" onScan={handleScanReceive} />
            {lastScan && <Banner tone="success">{lastScan}</Banner>}
            <FormLayout>
              {(selectedPo?.po_line_items ?? []).map((line) => {
                const v = Array.isArray(line.variants) ? line.variants[0] : line.variants;
                const remaining = Math.max(0, line.ordered_qty - line.received_qty);
                const lineDone = remaining === 0 && line.ordered_qty > 0;
                return (
                  <InlineStack key={line.id} gap="300" blockAlign="center" wrap={false}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <TextField
                        label={`${v?.title ?? v?.sku ?? "Line"} · ordered ${line.ordered_qty}, received ${line.received_qty}, remaining ${remaining}`}
                        type="number"
                        value={receiveQtys[line.id] ?? ""}
                        onChange={(val) => setReceiveQtys({ ...receiveQtys, [line.id]: val })}
                        autoComplete="off"
                        disabled={remaining === 0}
                      />
                    </div>
                    <StatusBadge
                      status={lineDone ? "completed" : line.received_qty > 0 ? "partially_received" : "pending"}
                      label={lineDone ? "Complete" : line.received_qty > 0 ? "Partial" : "Incomplete"}
                    />
                  </InlineStack>
                );
              })}
            </FormLayout>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
