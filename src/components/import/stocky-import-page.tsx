"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  Checkbox,
  InlineStack,
  Page,
  Select,
  Text,
} from "@shopify/polaris";
import { StreamingUploader } from "@/components/csv-import/StreamingUploader";
import { apiUrl, useShop, shopFetch } from "@/lib/hooks/use-shop";

type ImportType = "suppliers" | "purchase_orders";

export function StockyImportPageClient() {
  const shop = useShop();
  const qs = shop ? `?shop=${encodeURIComponent(shop)}` : "";
  const [importType, setImportType] = useState<ImportType>("suppliers");
  const [createMissingSuppliers, setCreateMissingSuppliers] = useState(true);
  const [doneHint, setDoneHint] = useState(false);

  return (
    <Page
      title="Import from Stocky"
      subtitle="Streaming CSV import — 5,000-row chunks, safe for 200k+ rows"
      backAction={{ content: "Home", url: `/app${qs}` }}
    >
      <BlockStack gap="400">
        <Banner tone="info">
          Stocky shuts down August 31, 2026. Export purchase orders from Stocky, sync your
          catalog first, then upload here. Large files stream in chunks so the browser and
          server stay under memory limits.
        </Banner>

        {doneHint && (
          <Banner tone="success" onDismiss={() => setDoneHint(false)}>
            Import finished. Review{" "}
            <Link href={`/app/suppliers${qs}`}>Suppliers</Link>
            {" "}and{" "}
            <Link href={`/app/purchase-orders${qs}`}>Purchases</Link>.
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
                setDoneHint(false);
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
          </BlockStack>
        </Card>

        <StreamingUploader
          key={importType}
          type={importType}
          shop={shop}
          createMissingSuppliers={createMissingSuppliers}
          onComplete={() => setDoneHint(true)}
        />

        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              How to export from Stocky
            </Text>
            <Text as="p" tone="subdued">
              1. In Stocky → Purchases, export POs as CSV. 2. Copy suppliers into our template.
              3. Sync inventory in StockMe. 4. Upload here (streams automatically).
            </Text>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
