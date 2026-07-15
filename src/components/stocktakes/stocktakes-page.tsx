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
  Modal,
  Page,
  Select,
  Text,
  TextField,
  useIndexResourceState,
} from "@shopify/polaris";
import { apiUrl, useShop, shopFetch } from "@/lib/hooks/use-shop";
import { BarcodeScanner } from "@/components/barcode-scanner";

type Stocktake = {
  id: string;
  name: string;
  status: string;
  locations: { name: string } | { name: string }[];
};

const LINES_PAGE_SIZE = 50;

export function StocktakesPageClient() {
  const shop = useShop();
  const [stocktakes, setStocktakes] = useState<Stocktake[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lines, setLines] = useState<{ variant_id: string; sku: string; title: string; system_qty: number; counted_qty: number | null }[]>([]);
  const [linesPage, setLinesPage] = useState(1);
  const [name, setName] = useState("");
  const [locationId, setLocationId] = useState("");
  const [manualBarcode, setManualBarcode] = useState("");
  const [countQty, setCountQty] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stRes, invRes] = await Promise.all([
        shopFetch("/api/stocktakes", shop),
        shopFetch("/api/inventory", shop),
      ]);
      if (!stRes.ok || !invRes.ok) {
        setError("Failed to load stocktakes");
        setLoading(false);
        return;
      }
      const stData = await stRes.json();
      const invData = await invRes.json();
      setStocktakes(stData.stocktakes ?? []);
      setLocations(invData.locations ?? []);
    } catch {
      setError("Failed to load stocktakes");
    } finally {
      setLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    load();
  }, [load]);

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(stocktakes as unknown as { [key: string]: unknown }[], {
      resourceIDResolver: (r) => (r as unknown as Stocktake).id,
    });

  const bulkComplete = async () => {
    let failures = 0;
    for (const id of selectedResources) {
      const st = stocktakes.find((s) => s.id === id);
      if (st?.status === "in_progress") {
        const res = await shopFetch(`/api/stocktakes/${id}`, shop, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "complete" }),
        });
        if (!res.ok) failures += 1;
      }
    }
    if (failures > 0) setError(`${failures} stocktake(s) could not be completed`);
    load();
  };

  const createStocktake = async () => {
    const res = await shopFetch("/api/stocktakes", shop, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, locationId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create stocktake");
      return;
    }
    setOpen(false);
    setName("");
    load();
  };

  const openStocktake = async (id: string) => {
    const res = await shopFetch(`/api/stocktakes/${id}`, shop);
    if (!res.ok) {
      setError("Failed to load stocktake");
      return;
    }
    const data = await res.json();
    const st = data.stocktake;
    setActiveId(id);
    setLinesPage(1);
    setLines(
      (st.stocktake_lines ?? []).map((l: { variant_id: string; system_qty: number; counted_qty: number | null; variants: { sku: string; title: string } }) => ({
        variant_id: l.variant_id,
        system_qty: l.system_qty,
        counted_qty: l.counted_qty,
        sku: l.variants?.sku ?? "",
        title: l.variants?.title ?? "",
      })),
    );
  };

  const recordCount = async (barcode?: string, variantId?: string) => {
    if (!activeId) return;
    const res = await shopFetch(`/api/stocktakes/${activeId}`, shop, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "count",
        barcode,
        variantId,
        countedQty: Number(countQty),
        barcodeScanned: Boolean(barcode),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Count failed");
      return;
    }
    openStocktake(activeId);
  };

  const completeStocktake = async () => {
    if (!activeId) return;
    const res = await shopFetch(`/api/stocktakes/${activeId}`, shop, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to complete stocktake");
      return;
    }
    setActiveId(null);
    load();
  };

  const closeCountModal = () => {
    setActiveId(null);
    setManualBarcode("");
    setCountQty("1");
    setLinesPage(1);
  };

  const rows = stocktakes.map((st, i) => {
    const loc = Array.isArray(st.locations) ? st.locations[0] : st.locations;
    return (
      <IndexTable.Row
        id={st.id}
        key={st.id}
        position={i}
        selected={selectedResources.includes(st.id)}
      >
        <IndexTable.Cell>{st.name}</IndexTable.Cell>
        <IndexTable.Cell>{st.status}</IndexTable.Cell>
        <IndexTable.Cell>{loc?.name ?? "—"}</IndexTable.Cell>
        <IndexTable.Cell>
          {st.status === "in_progress" && (
            <Button size="slim" onClick={() => openStocktake(st.id)}>Count</Button>
          )}
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  const countedCount = lines.filter((l) => l.counted_qty != null).length;
  const linesTotalPages = Math.ceil(lines.length / LINES_PAGE_SIZE) || 1;
  const visibleLines = lines.slice(
    (linesPage - 1) * LINES_PAGE_SIZE,
    linesPage * LINES_PAGE_SIZE,
  );

  return (
    <Page
      title="Stock Takes"
      primaryAction={{ content: "New stocktake", onAction: () => setOpen(true) }}
      secondaryActions={[{ content: "Export CSV", url: apiUrl("/api/stocktakes?export=csv", shop) }]}
    >
      <BlockStack gap="400">
        {error && <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>}
        <Card padding="0">
          <IndexTable
            resourceName={{ singular: "stocktake", plural: "stocktakes" }}
            itemCount={stocktakes.length}
            selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
            onSelectionChange={handleSelectionChange}
            headings={[{ title: "Name" }, { title: "Status" }, { title: "Location" }, { title: "" }]}
            loading={loading}
            bulkActions={[{ content: "Complete selected", onAction: bulkComplete }]}
          >
            {rows}
          </IndexTable>
        </Card>
      </BlockStack>

      <Modal open={open} onClose={() => setOpen(false)} title="New stocktake"
        primaryAction={{ content: "Start", onAction: createStocktake }}
        secondaryActions={[{ content: "Cancel", onAction: () => setOpen(false) }]}>
        <Modal.Section>
          <FormLayout>
            <TextField label="Name" value={name} onChange={setName} autoComplete="off" />
            <Select label="Location" options={locations.map((l) => ({ label: l.name, value: l.id }))} value={locationId} onChange={setLocationId} />
          </FormLayout>
        </Modal.Section>
      </Modal>

      <Modal open={Boolean(activeId)} onClose={closeCountModal} title="Stock count" size="large"
        primaryAction={{ content: "Complete & adjust Shopify", onAction: completeStocktake }}
        secondaryActions={[{ content: "Close", onAction: closeCountModal }]}>
        <Modal.Section>
          <BlockStack gap="300">
            <BarcodeScanner
              elementId="stocktake-scanner"
              onScan={(barcode) => {
                setManualBarcode(barcode);
                recordCount(barcode);
              }}
            />
            <FormLayout>
              <TextField label="Manual barcode" value={manualBarcode} onChange={setManualBarcode} autoComplete="off" />
              <TextField label="Counted qty" value={countQty} onChange={setCountQty} autoComplete="off" />
              <Button onClick={() => recordCount(manualBarcode)}>Record count</Button>
            </FormLayout>
            <Text as="h3" variant="headingSm">Lines ({countedCount}/{lines.length} counted)</Text>
            {visibleLines.map((l) => (
              <Text key={l.variant_id} as="p" variant="bodySm">
                {l.sku || l.title}: system {l.system_qty} → counted {l.counted_qty ?? "—"}
              </Text>
            ))}
            {linesTotalPages > 1 && (
              <InlineStack gap="200" align="center">
                <Button disabled={linesPage <= 1} onClick={() => setLinesPage((p) => p - 1)}>
                  Previous
                </Button>
                <Text as="span" tone="subdued">
                  Page {linesPage} of {linesTotalPages}
                </Text>
                <Button disabled={linesPage >= linesTotalPages} onClick={() => setLinesPage((p) => p + 1)}>
                  Next
                </Button>
              </InlineStack>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
