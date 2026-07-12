"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  FormLayout,
  IndexTable,
  Modal,
  Page,
  Select,
  TextField,
  useIndexResourceState,
} from "@shopify/polaris";
import { apiUrl, useShop } from "@/lib/hooks/use-shop";
import { usePlanFeatures } from "@/lib/hooks/use-plan";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { UpgradeBanner } from "@/components/upgrade-banner";

type Transfer = {
  id: string;
  transfer_number: string;
  status: string;
  from_location: { name: string } | { name: string }[];
  to_location: { name: string } | { name: string }[];
};

type VariantOption = {
  variant_id: string;
  product_title: string;
  variant_title: string;
  sku: string | null;
  barcode: string | null;
};

export function TransfersPageClient() {
  const shop = useShop();
  const plan = usePlanFeatures();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [variantSearch, setVariantSearch] = useState("");
  const [qty, setQty] = useState("1");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [trRes, invRes] = await Promise.all([
        fetch(apiUrl("/api/transfers", shop)),
        fetch(apiUrl("/api/inventory", shop)),
      ]);
      if (!trRes.ok || !invRes.ok) {
        setError("Failed to load transfers");
        setLoading(false);
        return;
      }
      const trData = await trRes.json();
      const invData = await invRes.json();
      setTransfers(trData.transfers ?? []);
      setLocations(invData.locations ?? []);
      const primary = invData.locations?.[0]?.id;
      if (primary) {
        const listRes = await fetch(
          apiUrl(`/api/inventory?locationId=${primary}&limit=100`, shop),
        );
        const listData = await listRes.json();
        setVariantOptions(listData.items ?? []);
      }
    } catch {
      setError("Failed to load transfers");
    } finally {
      setLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    load();
  }, [load]);

  const searchVariants = async () => {
    const loc = fromId || locations[0]?.id;
    if (!loc) return;
    const res = await fetch(
      apiUrl(`/api/inventory?locationId=${loc}&search=${encodeURIComponent(variantSearch)}&limit=50`, shop),
    );
    const data = await res.json();
    setVariantOptions(data.items ?? []);
  };

  const createTransfer = async () => {
    if (!fromId || !toId) {
      setError("Select both From and To locations");
      return;
    }
    if (!variantId) {
      setError("Select a variant to transfer");
      return;
    }
    const res = await fetch(apiUrl("/api/transfers", shop), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromLocationId: fromId,
        toLocationId: toId,
        lines: [{ variantId, quantity: Number(qty) }],
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create transfer");
      return;
    }
    setOpen(false);
    setVariantId("");
    setQty("1");
    setVariantSearch("");
    load();
  };

  const transfersAllowed = plan.canTransfer;

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(transfers as unknown as { [key: string]: unknown }[], {
      resourceIDResolver: (r) => (r as unknown as Transfer).id,
    });

  const updateTransfer = async (id: string, action: string) => {
    const res = await fetch(apiUrl(`/api/transfers/${id}`, shop), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Transfer update failed");
      return false;
    }
    return true;
  };

  const bulkShip = async () => {
    let failures = 0;
    for (const id of selectedResources) {
      const t = transfers.find((tr) => tr.id === id);
      if (t?.status === "draft") {
        const ok = await updateTransfer(id, "ship");
        if (!ok) failures += 1;
      }
    }
    if (failures > 0) setError(`${failures} transfer(s) could not be shipped`);
    load();
  };

  const bulkReceive = async () => {
    let failures = 0;
    for (const id of selectedResources) {
      const t = transfers.find((tr) => tr.id === id);
      if (t?.status === "in_transit") {
        const ok = await updateTransfer(id, "receive");
        if (!ok) failures += 1;
      }
    }
    if (failures > 0) setError(`${failures} transfer(s) could not be received`);
    load();
  };

  const rows = transfers.map((t, i) => {
    const from = Array.isArray(t.from_location) ? t.from_location[0] : t.from_location;
    const to = Array.isArray(t.to_location) ? t.to_location[0] : t.to_location;
    return (
      <IndexTable.Row
        id={t.id}
        key={t.id}
        position={i}
        selected={selectedResources.includes(t.id)}
      >
        <IndexTable.Cell>{t.transfer_number}</IndexTable.Cell>
        <IndexTable.Cell>
          <StatusBadge status={t.status} />
        </IndexTable.Cell>
        <IndexTable.Cell>{from?.name} → {to?.name}</IndexTable.Cell>
        <IndexTable.Cell>
          {t.status === "draft" && <Button size="slim" disabled={!transfersAllowed} onClick={() => updateTransfer(t.id, "ship")}>Ship</Button>}
          {t.status === "in_transit" && <Button size="slim" disabled={!transfersAllowed} onClick={() => updateTransfer(t.id, "receive")}>Receive</Button>}
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title="Transfers"
      primaryAction={{
        content: "New transfer",
        onAction: () => setOpen(true),
        disabled: !transfersAllowed,
      }}
      secondaryActions={[{ content: "Export CSV", url: apiUrl("/api/transfers?export=csv", shop) }]}
    >
      <BlockStack gap="400">
        {error && <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>}
        {!plan.loading && !transfersAllowed && (
          <UpgradeBanner
            planTier={plan.planTier}
            feature="Stock transfers"
            shop={shop}
          />
        )}
        <Card padding="0">
          <IndexTable
            resourceName={{ singular: "transfer", plural: "transfers" }}
            itemCount={transfers.length}
            selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
            onSelectionChange={handleSelectionChange}
            headings={[{ title: "#" }, { title: "Status" }, { title: "Route" }, { title: "" }]}
            loading={loading}
            bulkActions={
              transfersAllowed
                ? [
                    { content: "Ship selected", onAction: bulkShip },
                    { content: "Receive selected", onAction: bulkReceive },
                  ]
                : []
            }
          >
            {rows}
          </IndexTable>
        </Card>
      </BlockStack>

      <Modal open={open} onClose={() => setOpen(false)} title="New transfer"
        primaryAction={{ content: "Create", onAction: createTransfer }}
        secondaryActions={[{ content: "Cancel", onAction: () => setOpen(false) }]}>
        <Modal.Section>
          <FormLayout>
            <Select
              label="From"
              options={[{ label: "Select location", value: "" }, ...locations.map((l) => ({ label: l.name, value: l.id }))]}
              value={fromId}
              onChange={setFromId}
            />
            <Select
              label="To"
              options={[{ label: "Select location", value: "" }, ...locations.map((l) => ({ label: l.name, value: l.id }))]}
              value={toId}
              onChange={setToId}
            />
            <TextField label="Search SKU/barcode" value={variantSearch} onChange={setVariantSearch} autoComplete="off" />
            <Button onClick={searchVariants}>Search variants</Button>
            <Select
              label="Variant"
              options={[
                { label: "Select variant", value: "" },
                ...variantOptions.map((v) => ({
                  label: `${v.sku ? `${v.sku} — ` : ""}${v.product_title}${v.variant_title !== "Default Title" ? ` / ${v.variant_title}` : ""}`,
                  value: v.variant_id,
                })),
              ]}
              value={variantId}
              onChange={setVariantId}
            />
            <TextField label="Quantity" value={qty} onChange={setQty} autoComplete="off" />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
