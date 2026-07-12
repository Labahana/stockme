"use client";

import {
  Banner,
  BlockStack,
  Button,
  Card,
  IndexTable,
  InlineStack,
  Text,
} from "@shopify/polaris";
import { StatusBadge } from "@/components/ui/StatusBadge";

type LowStockItem = {
  variant_id: string;
  product_title: string;
  variant_title: string;
  sku: string | null;
  available: number;
  min_stock: number;
};

export function LowStockAlert({
  items,
  loading,
  shop,
  onCreatePo,
}: {
  items: LowStockItem[];
  loading?: boolean;
  shop: string;
  onCreatePo?: () => void;
}) {
  const qs = shop ? `?shop=${encodeURIComponent(shop)}` : "";

  return (
    <Card padding="0">
      <div style={{ padding: "16px 20px" }}>
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingMd">
            Low Stock Items
          </Text>
          <InlineStack gap="200">
            {onCreatePo && (
              <Button onClick={onCreatePo} variant="primary">
                Create PO for all
              </Button>
            )}
            <Button url={`/app/reports${qs}`} variant="plain">
              View all
            </Button>
          </InlineStack>
        </InlineStack>
      </div>

      {items.length === 0 ? (
        <div style={{ padding: "0 20px 16px" }}>
          <Text as="p" tone="subdued">
            {loading ? "Loading…" : "No low-stock variants at your primary location."}
          </Text>
        </div>
      ) : (
        <IndexTable
          resourceName={{ singular: "product", plural: "products" }}
          itemCount={items.length}
          headings={[
            { title: "Product" },
            { title: "SKU" },
            { title: "Stock" },
            { title: "Min" },
            { title: "Status" },
          ]}
          selectable={false}
        >
          {items.map((item, index) => {
            const critical = item.min_stock > 0 && item.available <= item.min_stock * 0.5;
            return (
              <IndexTable.Row id={item.variant_id} key={item.variant_id} position={index}>
                <IndexTable.Cell>
                  <BlockStack gap="100">
                    <Text as="span" fontWeight="semibold">
                      {item.product_title}
                    </Text>
                    {item.variant_title && item.variant_title !== "Default Title" && (
                      <Text as="span" tone="subdued" variant="bodySm">
                        {item.variant_title}
                      </Text>
                    )}
                  </BlockStack>
                </IndexTable.Cell>
                <IndexTable.Cell>{item.sku ?? "—"}</IndexTable.Cell>
                <IndexTable.Cell>
                  <Text as="span" tone={critical ? "critical" : "caution"}>
                    {item.available}
                  </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>{item.min_stock}</IndexTable.Cell>
                <IndexTable.Cell>
                  <StatusBadge status={critical ? "critical" : "warning"} />
                </IndexTable.Cell>
              </IndexTable.Row>
            );
          })}
        </IndexTable>
      )}

      {items.length > 0 && (
        <div style={{ padding: 12 }}>
          <Banner tone="warning">
            {items.length} low-stock item{items.length === 1 ? "" : "s"} need attention.
          </Banner>
        </div>
      )}
    </Card>
  );
}
