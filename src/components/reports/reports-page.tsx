"use client";

import { useEffect, useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  DataTable,
  InlineStack,
  Page,
  Select,
  Text,
} from "@shopify/polaris";
import { apiUrl, useShop } from "@/lib/hooks/use-shop";
import { usePlanFeatures } from "@/lib/hooks/use-plan";

const REPORT_TYPES = [
  { label: "Low stock", value: "low_stock" },
  { label: "Stock valuation", value: "valuation" },
  { label: "Supplier performance", value: "supplier_performance" },
  { label: "Cost of goods (COGS)", value: "cogs" },
  { label: "Sell-through", value: "sell_through" },
];

export function ReportsPageClient() {
  const shop = useShop();
  const plan = usePlanFeatures();
  const [type, setType] = useState("low_stock");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [totals, setTotals] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportTypes = REPORT_TYPES.filter((r) => {
    if (r.value === "valuation") return plan.canBundleValuation;
    if (r.value === "supplier_performance") return plan.canSupplierPerformance;
    return true;
  });

  useEffect(() => {
    if (reportTypes.length > 0 && !reportTypes.some((r) => r.value === type)) {
      setType("low_stock");
    }
  }, [reportTypes, type]);

  const runReport = async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(apiUrl(`/api/reports?type=${type}`, shop));
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Report failed");
      setRows([]);
      setTotals({});
      setLoading(false);
      return;
    }
    setRows(data.rows ?? []);
    setTotals(data.totals ?? {});
    setLoading(false);
  };

  const columns = rows[0] ? Object.keys(rows[0]) : [];
  const tableRows = rows.map((r) => columns.map((c) => String(r[c] ?? "")));

  return (
    <Page title="Reports" subtitle="One-click reports with built-in totals">
      <BlockStack gap="400">
        {error && <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner>}
        <Card>
          <InlineStack gap="300" wrap blockAlign="end">
            <Select label="Report" options={reportTypes} value={type} onChange={setType} />
            <Button variant="primary" onClick={runReport} loading={loading}>Run report</Button>
            <Button url={apiUrl(`/api/reports?type=${type}&export=csv`, shop)}>Export CSV</Button>
          </InlineStack>
        </Card>

        {Object.keys(totals).length > 0 && (
          <Card>
            <Text as="h3" variant="headingSm">Totals</Text>
            <BlockStack gap="100">
              {Object.entries(totals).map(([k, v]) => (
                <Text key={k} as="p">{k}: {String(v)}</Text>
              ))}
            </BlockStack>
          </Card>
        )}

        {rows.length > 0 && (
          <Card>
            <DataTable columnContentTypes={columns.map(() => "text")} headings={columns} rows={tableRows} />
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
