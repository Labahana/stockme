"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  FormLayout,
  IndexTable,
  InlineStack,
  Layout,
  Page,
  ProgressBar,
  Text,
  TextField,
} from "@shopify/polaris";
import { useParams, useSearchParams } from "next/navigation";
import { apiUrl, shopFetch } from "@/lib/hooks/use-shop";
import { usePlanFeatures } from "@/lib/hooks/use-plan";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { BarcodeScannerModal } from "@/components/ui/BarcodeScannerModal";
import { UpgradeBanner } from "@/components/upgrade-banner";

type Line = {
  id: string;
  ordered_qty: number;
  received_qty: number;
  unit_cost: number;
  variants:
    | { sku: string; title: string; barcode?: string }
    | { sku: string; title: string; barcode?: string }[];
};

type PO = {
  id: string;
  po_number: string;
  status: string;
  notes: string | null;
  suppliers: { name: string; email?: string } | { name: string; email?: string }[];
  locations: { name: string } | { name: string }[];
  po_line_items: Line[];
  po_receipts?: {
    id: string;
    created_at: string;
    notes: string | null;
    po_receipt_lines?: { quantity: number }[];
  }[];
};

function one<T>(v: T | T[]): T | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function variantOf(line: Line) {
  return one(line.variants);
}

export function PODetail() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const shop = searchParams.get("shop") ?? "";
  const qs = shop ? `?shop=${encodeURIComponent(shop)}` : "";
  const id = params.id;
  const plan = usePlanFeatures();

  const [po, setPo] = useState<PO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({});
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [scanQty, setScanQty] = useState("1");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await shopFetch(`/api/purchase-orders/${id}`, shop);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "PO not found");
        setPo(null);
        return;
      }
      setPo(data.purchaseOrder);
    } catch {
      setError("Failed to load PO");
    } finally {
      setLoading(false);
    }
  }, [id, shop]);

  useEffect(() => {
    load();
  }, [load]);

  const sendPo = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    const res = await shopFetch(`/api/purchase-orders/${id}`, shop, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send" }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Send failed");
      return;
    }
    if (data.email?.sent) {
      setSuccess("PO emailed to supplier and marked as sent.");
    }
    await load();
  };

  const receive = async (all = false) => {
    if (!po) return;
    const lines = (po.po_line_items ?? [])
      .map((l) => {
        const remaining = Math.max(0, l.ordered_qty - l.received_qty);
        const qty = all
          ? remaining
          : Number(receiveQtys[l.id] ?? 0);
        return { poLineItemId: l.id, quantity: qty };
      })
      .filter((l) => l.quantity > 0);

    if (lines.length === 0) {
      setError("Enter at least one received quantity");
      return;
    }

    const invoicePayload =
      plan.canPartialInvoice && (invoiceNumber || invoiceAmount)
        ? {
            invoiceNumber: invoiceNumber || undefined,
            invoiceAmount: invoiceAmount ? Number(invoiceAmount) : undefined,
          }
        : undefined;

    setBusy(true);
    setError(null);
    const res = await shopFetch(`/api/purchase-orders/${id}`, shop, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "receive",
        lines,
        invoice: invoicePayload,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Receive failed");
      return;
    }
    setReceiveQtys({});
    setInvoiceNumber("");
    setInvoiceAmount("");
    await load();
  };

  const handleScan = async (barcode: string) => {
    const res = await shopFetch(`/api/purchase-orders/${id}`, shop, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "scan",
        barcode,
        quantity: Number(scanQty) || 1,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Scan failed");
      return;
    }
    setLastScan(`${data.variant?.sku ?? data.variant?.title} +${data.scanQty}`);
    setReceiveQtys((prev) => ({
      ...prev,
      [data.poLineItemId]: String(
        Number(prev[data.poLineItemId] ?? 0) + Number(data.scanQty),
      ),
    }));
  };

  if (loading && !po) {
    return (
      <Page title="Purchase Order" backAction={{ content: "Purchase Orders", url: `/app/purchase-orders${qs}` }}>
        <Text as="p">Loading…</Text>
      </Page>
    );
  }

  if (!po) {
    return (
      <Page title="Purchase Order" backAction={{ content: "Purchase Orders", url: `/app/purchase-orders${qs}` }}>
        <Banner tone="critical">{error ?? "Not found"}</Banner>
      </Page>
    );
  }

  const supplier = one(po.suppliers);
  const location = one(po.locations);
  const lines = po.po_line_items ?? [];
  const ordered = lines.reduce((s, l) => s + l.ordered_qty, 0);
  const received = lines.reduce((s, l) => s + l.received_qty, 0);
  const progress = ordered > 0 ? Math.round((received / ordered) * 100) : 0;
  const subtotal = lines.reduce((s, l) => s + l.ordered_qty * Number(l.unit_cost || 0), 0);
  const canReceive = ["sent", "partially_received"].includes(po.status);

  return (
    <Page
      title={`Purchase Order ${po.po_number}`}
      backAction={{ content: "Purchase Orders", url: `/app/purchase-orders${qs}` }}
      titleMetadata={<StatusBadge status={po.status} size="medium" />}
      secondaryActions={[
        { content: "Send", onAction: sendPo, disabled: po.status !== "draft" || busy },
        {
          content: "Print PDF",
          onAction: () => {
            void import("@/lib/export/po-pdf").then(({ downloadPurchaseOrderPdf }) => {
              downloadPurchaseOrderPdf(po as never);
            });
          },
        },
        {
          content: "Download CSV",
          url: apiUrl(`/api/purchase-orders?export=csv`, shop),
        },
      ]}
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="critical" onDismiss={() => setError(null)}>
              {error}
            </Banner>
          </Layout.Section>
        )}
        {success && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSuccess(null)}>
              {success}
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <Text as="p">
                From: <Text as="span" fontWeight="semibold">{supplier?.name ?? "—"}</Text>
              </Text>
              <Text as="p">
                To: <Text as="span" fontWeight="semibold">{location?.name ?? "—"}</Text>
              </Text>
              {po.notes && (
                <Text as="p" tone="subdued">
                  {po.notes}
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card padding="0">
            <div style={{ padding: "16px 20px" }}>
              <Text as="h2" variant="headingMd">
                Line Items
              </Text>
            </div>
            <IndexTable
              resourceName={{ singular: "line", plural: "lines" }}
              itemCount={lines.length}
              headings={[
                { title: "Product" },
                { title: "SKU" },
                { title: "Cost" },
                { title: "Qty" },
                { title: "Received" },
                { title: "Total" },
              ]}
              selectable={false}
            >
              {lines.map((line, index) => {
                const v = variantOf(line);
                const total = line.ordered_qty * Number(line.unit_cost || 0);
                return (
                  <IndexTable.Row id={line.id} key={line.id} position={index}>
                    <IndexTable.Cell>{v?.title ?? "—"}</IndexTable.Cell>
                    <IndexTable.Cell>{v?.sku ?? "—"}</IndexTable.Cell>
                    <IndexTable.Cell>${Number(line.unit_cost || 0).toFixed(2)}</IndexTable.Cell>
                    <IndexTable.Cell>{line.ordered_qty}</IndexTable.Cell>
                    <IndexTable.Cell>{line.received_qty}</IndexTable.Cell>
                    <IndexTable.Cell>${total.toFixed(2)}</IndexTable.Cell>
                  </IndexTable.Row>
                );
              })}
            </IndexTable>
            <div style={{ padding: 16, borderTop: "1px solid #e1e3e5" }}>
              <InlineStack align="space-between">
                <Text as="span" fontWeight="semibold">
                  TOTAL
                </Text>
                <Text as="span" fontWeight="semibold">
                  ${subtotal.toFixed(2)} · {lines.length} lines
                </Text>
              </InlineStack>
            </div>
          </Card>
        </Layout.Section>

        {canReceive && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Receive Items
                </Text>
                <Text as="p" tone="subdued">
                  {received} / {ordered} items ({progress}%)
                </Text>
                <ProgressBar progress={progress} size="small" />
                <InlineStack gap="200" wrap>
                  {plan.canScanReceive ? (
                    <Button onClick={() => setScanOpen(true)}>Scan with Camera</Button>
                  ) : (
                    <Button disabled>Scan with Camera (Growth+)</Button>
                  )}
                  <Button onClick={() => receive(true)} loading={busy}>
                    Receive All
                  </Button>
                  <Button variant="primary" onClick={() => receive(false)} loading={busy}>
                    Receive & Sync to Shopify
                  </Button>
                </InlineStack>
                {!plan.loading && !plan.canScanReceive && (
                  <UpgradeBanner
                    planTier={plan.planTier}
                    feature="Barcode scan-to-receive"
                    shop={shop}
                  />
                )}
                <FormLayout>
                  {plan.canScanReceive && (
                    <TextField
                      label="Scan quantity per barcode"
                      type="number"
                      value={scanQty}
                      onChange={setScanQty}
                      autoComplete="off"
                    />
                  )}
                  {plan.canPartialInvoice ? (
                    <>
                      <TextField
                        label="Invoice # (this shipment)"
                        value={invoiceNumber}
                        onChange={setInvoiceNumber}
                        autoComplete="off"
                      />
                      <TextField
                        label="Invoice amount"
                        type="number"
                        value={invoiceAmount}
                        onChange={setInvoiceAmount}
                        autoComplete="off"
                      />
                    </>
                  ) : (
                    <UpgradeBanner
                      planTier={plan.planTier}
                      feature="Per-shipment invoice recording"
                      requiredTier="pro"
                      shop={shop}
                    />
                  )}
                </FormLayout>
                <IndexTable
                  resourceName={{ singular: "line", plural: "lines" }}
                  itemCount={lines.length}
                  headings={[
                    { title: "Product" },
                    { title: "Ordered" },
                    { title: "Received" },
                    { title: "Remaining" },
                    { title: "Qty now" },
                  ]}
                  selectable={false}
                >
                  {lines.map((line, index) => {
                    const v = variantOf(line);
                    const remaining = Math.max(0, line.ordered_qty - line.received_qty);
                    return (
                      <IndexTable.Row id={`recv-${line.id}`} key={line.id} position={index}>
                        <IndexTable.Cell>{v?.title ?? "—"}</IndexTable.Cell>
                        <IndexTable.Cell>{line.ordered_qty}</IndexTable.Cell>
                        <IndexTable.Cell>{line.received_qty}</IndexTable.Cell>
                        <IndexTable.Cell>{remaining}</IndexTable.Cell>
                        <IndexTable.Cell>
                          <TextField
                            label="Qty"
                            labelHidden
                            type="number"
                            value={receiveQtys[line.id] ?? ""}
                            onChange={(val) =>
                              setReceiveQtys((prev) => ({ ...prev, [line.id]: val }))
                            }
                            autoComplete="off"
                            disabled={remaining === 0}
                          />
                        </IndexTable.Cell>
                      </IndexTable.Row>
                    );
                  })}
                </IndexTable>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {(po.po_receipts?.length ?? 0) > 0 && (
          <Layout.Section>
            <Card padding="0">
              <div style={{ padding: "16px 20px" }}>
                <Text as="h2" variant="headingMd">
                  Receipt History
                </Text>
              </div>
              <IndexTable
                resourceName={{ singular: "receipt", plural: "receipts" }}
                itemCount={po.po_receipts!.length}
                headings={[{ title: "Receipt" }, { title: "Date" }, { title: "Items" }, { title: "Notes" }]}
                selectable={false}
              >
                {po.po_receipts!.map((r, index) => {
                  const qty = (r.po_receipt_lines ?? []).reduce((s, l) => s + l.quantity, 0);
                  return (
                    <IndexTable.Row id={r.id} key={r.id} position={index}>
                      <IndexTable.Cell>{r.id.slice(0, 8)}</IndexTable.Cell>
                      <IndexTable.Cell>{new Date(r.created_at).toLocaleString()}</IndexTable.Cell>
                      <IndexTable.Cell>{qty}</IndexTable.Cell>
                      <IndexTable.Cell>{r.notes ?? "—"}</IndexTable.Cell>
                    </IndexTable.Row>
                  );
                })}
              </IndexTable>
            </Card>
          </Layout.Section>
        )}
      </Layout>

      <BarcodeScannerModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onScan={handleScan}
        lastScanLabel={lastScan}
      />
    </Page>
  );
}
