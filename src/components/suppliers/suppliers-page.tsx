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
import { apiUrl, useShop } from "@/lib/hooks/use-shop";

type Supplier = {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  lead_time_days: number;
  supplier_products?: { count: number }[];
};

type LinkedProduct = {
  id: string;
  supplier_sku: string | null;
  pack_size: number;
  moq: number;
  unit_cost: number | null;
  variants: {
    id: string;
    sku: string | null;
    title: string;
    barcode: string | null;
    products: { title: string } | { title: string }[];
  } | {
    id: string;
    sku: string | null;
    title: string;
    barcode: string | null;
    products: { title: string } | { title: string }[];
  }[];
};

type VariantOption = {
  variant_id: string;
  product_title: string;
  variant_title: string;
  sku: string | null;
};

export function SuppliersPageClient() {
  const shop = useShop();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [activeSupplier, setActiveSupplier] = useState<Supplier | null>(null);
  const [linkedProducts, setLinkedProducts] = useState<LinkedProduct[]>([]);
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([]);
  const [linkForm, setLinkForm] = useState({
    variantId: "",
    supplierSku: "",
    packSize: "1",
    moq: "1",
    unitCost: "",
  });
  const [form, setForm] = useState({
    name: "",
    contact_name: "",
    email: "",
    phone: "",
    lead_time_days: "7",
  });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/suppliers", shop));
      if (!res.ok) {
        setError("Failed to load suppliers");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setSuppliers(data.suppliers ?? []);
    } catch {
      setError("Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  }, [shop]);

  useEffect(() => {
    load();
  }, [load]);

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(suppliers as unknown as { [key: string]: unknown }[], {
      resourceIDResolver: (r) => (r as unknown as Supplier).id,
    });

  const createSupplier = async () => {
    const res = await fetch(apiUrl("/api/suppliers", shop), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        contact_name: form.contact_name || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        lead_time_days: Number(form.lead_time_days),
      }),
    });
    if (!res.ok) {
      setError("Failed to create supplier");
      return;
    }
    setOpen(false);
    setForm({ name: "", contact_name: "", email: "", phone: "", lead_time_days: "7" });
    load();
  };

  const deleteSelected = async () => {
    let failures = 0;
    for (const id of selectedResources) {
      const res = await fetch(apiUrl(`/api/suppliers/${id}`, shop), { method: "DELETE" });
      if (!res.ok) failures += 1;
    }
    if (failures > 0) setError(`${failures} supplier(s) could not be deleted`);
    load();
  };

  const openProducts = async (supplier: Supplier) => {
    setActiveSupplier(supplier);
    setProductsOpen(true);
    setError(null);

    const [productsRes, invRes] = await Promise.all([
      fetch(apiUrl(`/api/suppliers/${supplier.id}/products`, shop)),
      fetch(apiUrl("/api/inventory", shop)),
    ]);
    if (!productsRes.ok || !invRes.ok) {
      setError("Failed to load supplier products");
      return;
    }
    const productsData = await productsRes.json();
    setLinkedProducts(productsData.products ?? []);

    const invData = await invRes.json();
    const primaryLocation = invData.locations?.[0]?.id;
    if (primaryLocation) {
      const listRes = await fetch(
        apiUrl(`/api/inventory?locationId=${primaryLocation}&limit=100`, shop),
      );
      const listData = await listRes.json();
      setVariantOptions(
        (listData.items ?? []).map((item: VariantOption) => ({
          variant_id: item.variant_id,
          product_title: item.product_title,
          variant_title: item.variant_title,
          sku: item.sku,
        })),
      );
    }
  };

  const linkProduct = async () => {
    if (!activeSupplier || !linkForm.variantId) return;
    const res = await fetch(apiUrl(`/api/suppliers/${activeSupplier.id}/products`, shop), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variantId: linkForm.variantId,
        supplierSku: linkForm.supplierSku || undefined,
        packSize: Number(linkForm.packSize),
        moq: Number(linkForm.moq),
        unitCost: linkForm.unitCost ? Number(linkForm.unitCost) : undefined,
        isPrimary: true,
      }),
    });
    if (!res.ok) {
      setError("Failed to link product");
      return;
    }
    openProducts(activeSupplier);
    setLinkForm({ variantId: "", supplierSku: "", packSize: "1", moq: "1", unitCost: "" });
  };

  const unlinkProduct = async (variantId: string) => {
    if (!activeSupplier) return;
    const res = await fetch(
      apiUrl(`/api/suppliers/${activeSupplier.id}/products?variantId=${variantId}`, shop),
      { method: "DELETE" },
    );
    if (!res.ok) {
      setError("Failed to unlink product");
      return;
    }
    openProducts(activeSupplier);
  };

  const productCount = (s: Supplier) => {
    const row = s.supplier_products?.[0];
    return row?.count ?? 0;
  };

  const rows = suppliers.map((s, i) => (
    <IndexTable.Row id={s.id} key={s.id} position={i} selected={selectedResources.includes(s.id)}>
      <IndexTable.Cell>{s.name}</IndexTable.Cell>
      <IndexTable.Cell>{s.contact_name ?? "—"}</IndexTable.Cell>
      <IndexTable.Cell>{s.email ?? "—"}</IndexTable.Cell>
      <IndexTable.Cell>{s.phone ?? "—"}</IndexTable.Cell>
      <IndexTable.Cell>{s.lead_time_days}d</IndexTable.Cell>
      <IndexTable.Cell>{productCount(s)}</IndexTable.Cell>
      <IndexTable.Cell>
        <Button size="slim" onClick={() => openProducts(s)}>Products</Button>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  const linkedRows = linkedProducts.map((p, i) => {
    const variant = Array.isArray(p.variants) ? p.variants[0] : p.variants;
    const product = variant?.products
      ? Array.isArray(variant.products)
        ? variant.products[0]
        : variant.products
      : null;
    const label = variant?.sku
      ? `${variant.sku} — ${product?.title ?? variant.title}`
      : `${product?.title ?? variant?.title ?? "—"}`;

    return (
      <IndexTable.Row id={p.id} key={p.id} position={i}>
        <IndexTable.Cell>{label}</IndexTable.Cell>
        <IndexTable.Cell>{p.supplier_sku ?? "—"}</IndexTable.Cell>
        <IndexTable.Cell>{p.pack_size}</IndexTable.Cell>
        <IndexTable.Cell>{p.moq}</IndexTable.Cell>
        <IndexTable.Cell>{p.unit_cost ?? "—"}</IndexTable.Cell>
        <IndexTable.Cell>
          <Button size="slim" tone="critical" onClick={() => variant && unlinkProduct(variant.id)}>
            Remove
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title="Suppliers"
      primaryAction={{ content: "Add supplier", onAction: () => setOpen(true) }}
      secondaryActions={[
        {
          content: "Export CSV",
          url: apiUrl("/api/suppliers?export=csv", shop),
        },
      ]}
    >
      <BlockStack gap="400">
        {error && <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>}
        <Card padding="0">
          <IndexTable
            resourceName={{ singular: "supplier", plural: "suppliers" }}
            itemCount={suppliers.length}
            selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
            onSelectionChange={handleSelectionChange}
            headings={[
              { title: "Name" },
              { title: "Contact" },
              { title: "Email" },
              { title: "Phone" },
              { title: "Lead time" },
              { title: "Products" },
              { title: "" },
            ]}
            loading={loading}
            bulkActions={[{ content: "Delete", onAction: deleteSelected }]}
          >
            {rows}
          </IndexTable>
        </Card>
      </BlockStack>

      <Modal open={open} onClose={() => setOpen(false)} title="Add supplier"
        primaryAction={{ content: "Save", onAction: createSupplier }}
        secondaryActions={[{ content: "Cancel", onAction: () => setOpen(false) }]}>
        <Modal.Section>
          <FormLayout>
            <TextField label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} autoComplete="off" />
            <TextField label="Contact" value={form.contact_name} onChange={(v) => setForm({ ...form, contact_name: v })} autoComplete="off" />
            <TextField label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} autoComplete="off" />
            <TextField label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} autoComplete="off" />
            <TextField label="Lead time (days)" type="number" value={form.lead_time_days} onChange={(v) => setForm({ ...form, lead_time_days: v })} autoComplete="off" />
          </FormLayout>
        </Modal.Section>
      </Modal>

      <Modal
        open={productsOpen}
        onClose={() => {
          setProductsOpen(false);
          setActiveSupplier(null);
          setLinkedProducts([]);
          setLinkForm({ variantId: "", supplierSku: "", packSize: "1", moq: "1", unitCost: "" });
        }}
        title={activeSupplier ? `Products — ${activeSupplier.name}` : "Supplier products"}
        size="large"
        secondaryActions={[{ content: "Close", onAction: () => {
          setProductsOpen(false);
          setActiveSupplier(null);
          setLinkedProducts([]);
          setLinkForm({ variantId: "", supplierSku: "", packSize: "1", moq: "1", unitCost: "" });
        } }]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text as="p" tone="subdued">
              Link variants to this supplier for forecasting pack size and MOQ.
            </Text>
            <FormLayout>
              <Select
                label="Variant"
                placeholder="Select variant"
                options={[
                  { label: "Select variant", value: "" },
                  ...variantOptions.map((v) => ({
                    label: `${v.sku ? `${v.sku} — ` : ""}${v.product_title}${v.variant_title !== "Default Title" ? ` / ${v.variant_title}` : ""}`,
                    value: v.variant_id,
                  })),
                ]}
                value={linkForm.variantId}
                onChange={(v) => setLinkForm({ ...linkForm, variantId: v })}
              />
              <InlineStack gap="300">
                <TextField label="Supplier SKU" value={linkForm.supplierSku} onChange={(v) => setLinkForm({ ...linkForm, supplierSku: v })} autoComplete="off" />
                <TextField label="Pack size" type="number" value={linkForm.packSize} onChange={(v) => setLinkForm({ ...linkForm, packSize: v })} autoComplete="off" />
                <TextField label="MOQ" type="number" value={linkForm.moq} onChange={(v) => setLinkForm({ ...linkForm, moq: v })} autoComplete="off" />
                <TextField label="Unit cost" type="number" value={linkForm.unitCost} onChange={(v) => setLinkForm({ ...linkForm, unitCost: v })} autoComplete="off" />
              </InlineStack>
              <Button onClick={linkProduct}>Link product</Button>
            </FormLayout>
            <Card padding="0">
              <IndexTable
                resourceName={{ singular: "product", plural: "products" }}
                itemCount={linkedProducts.length}
                headings={[
                  { title: "Variant" },
                  { title: "Supplier SKU" },
                  { title: "Pack" },
                  { title: "MOQ" },
                  { title: "Cost" },
                  { title: "" },
                ]}
              >
                {linkedRows}
              </IndexTable>
            </Card>
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
