"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  DropZone,
  InlineStack,
  Page,
  Select,
  Text,
} from "@shopify/polaris";
import { apiUrl, useShop } from "@/lib/hooks/use-shop";

type ImportType = "suppliers" | "purchase_orders";

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
};

export function StockyImportPageClient() {
  const shop = useShop();
  const qs = shop ? `?shop=${encodeURIComponent(shop)}` : "";
  const [importType, setImportType] = useState<ImportType>("suppliers");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [createMissingSuppliers, setCreateMissingSuppliers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrop = (_dropFiles: File[], acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result ?? ""));
      setResult(null);
      setError(null);
    };
    reader.onerror = () => {
      setError("Could not read file");
      setFileName(null);
    };
    reader.readAsText(file);
  };

  const runImport = async () => {
    if (!csvText.trim()) {
      setError("Upload a CSV file first");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(apiUrl("/api/import/stocky", shop), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: importType,
          csv: csvText,
          createMissingSuppliers,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed");
        return;
      }
      setResult(data);
    } catch {
      setError("Import failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page
      title="Import from Stocky"
      subtitle="Upload Stocky CSV exports — suppliers and purchase order history"
      backAction={{ content: "Dashboard", url: `/app${qs}` }}
    >
      <BlockStack gap="400">
        <Banner tone="info">
          Stocky shuts down August 31, 2026. Export your purchase orders from Stocky now,
          then upload them here. Supplier records must be exported manually from Stocky
          into a spreadsheet — use our template if needed.
        </Banner>

        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}

        {result && (
          <Banner tone={result.errors.length > 0 ? "warning" : "success"}>
            <BlockStack gap="100">
              <Text as="p">
                Created {result.created}, updated {result.updated}, skipped {result.skipped}
              </Text>
              {result.errors.length > 0 && (
                <Text as="p" variant="bodySm">
                  {result.errors.slice(0, 8).join(" · ")}
                  {result.errors.length > 8 ? ` · +${result.errors.length - 8} more` : ""}
                </Text>
              )}
            </BlockStack>
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <Select
              label="Import type"
              options={[
                { label: "Suppliers", value: "suppliers" },
                { label: "Purchase orders", value: "purchase_orders" },
              ]}
              value={importType}
              onChange={(v) => {
                setImportType(v as ImportType);
                setCsvText("");
                setFileName(null);
                setResult(null);
                setError(null);
              }}
            />

            <InlineStack gap="200">
              <Button url={apiUrl(`/api/import/stocky?sample=${importType}`, shop)}>
                Download template
              </Button>
            </InlineStack>

            {importType === "purchase_orders" && (
              <Checkbox
                label="Create suppliers that don't exist yet"
                checked={createMissingSuppliers}
                onChange={setCreateMissingSuppliers}
              />
            )}

            <DropZone accept=".csv,text/csv" type="file" onDrop={handleDrop}>
              {fileName ? (
                <Text as="p">{fileName} ready to import</Text>
              ) : (
                <DropZone.FileUpload actionHint="Accepts .csv from Stocky export" />
              )}
            </DropZone>

            <Button variant="primary" loading={loading} onClick={runImport}>
              Import CSV
            </Button>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">How to export from Stocky</Text>
            <Text as="p" tone="subdued">
              1. In Stocky, export Purchase Orders as CSV. 2. Copy suppliers into our template.
              3. Sync inventory first. 4. Upload here.
            </Text>
            <Text as="p" tone="subdued">
              After import, review{" "}
              <Link href={`/app/suppliers${qs}`}>Suppliers</Link>
              {" "}and{" "}
              <Link href={`/app/purchase-orders${qs}`}>Purchase Orders</Link>.
            </Text>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
