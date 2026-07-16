"use client";

import { useEffect, useState } from "react";
import {
  Banner,
  BlockStack,
  Button,
  Card,
  InlineStack,
  Page,
  Select,
  Text,
} from "@shopify/polaris";
import { apiUrl, useShop, shopFetch } from "@/lib/hooks/use-shop";
import { usePlanFeatures } from "@/lib/hooks/use-plan";
import { DataTableWithTotals } from "@/components/ui/DataTableWithTotals";

/** Labels aligned with Stocky Reports menu */
const REPORT_TYPES = [
  { label: "Low Stock Variants", value: "low_stock" },
  { label: "Current Stock on Hand", value: "valuation" },
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
    const res = await shopFetch(`/api/reports?type=${type}`, shop);
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
  const footerTotals = columns.map((c, i) => {
    if (i === 0) return "Totals";
    if (c in totals) return totals[c] as string | number;
    // sum numeric columns when totals object doesn't name them
    const sample = rows[0]?.[c];
    if (typeof sample === "number" || (typeof sample === "string" && sample !== "" && !Number.isNaN(Number(sample)))) {
      const sum = rows.reduce((acc, row) => acc + (Number(row[c]) || 0), 0);
      return Number.isFinite(sum) ? sum : "";
    }
    return "";
  });

  return (
    <Page title="Reports" subtitle="Stock analytics with built-in footer totals — export CSV anytime">
      <BlockStack gap="400">
        {error && (
          <Banner tone="critical" onDismiss={() => setError(null)}>
            {error}
          </Banner>
        )}
        <Card>
          <InlineStack gap="300" wrap blockAlign="end">
            <Select label="Report" options={reportTypes} value={type} onChange={setType} />
            <Button variant="primary" onClick={runReport} loading={loading}>
              Run report
            </Button>
            <Button url={apiUrl(`/api/reports?type=${type}&export=csv`, shop)}>Export CSV</Button>
          </InlineStack>
        </Card>

        {Object.keys(totals).length > 0 && (
          <Card>
            <Text as="h3" variant="headingSm">
              Summary
            </Text>
            <BlockStack gap="100">
              {Object.entries(totals).map(([k, v]) => (
                <Text key={k} as="p">
                  {k}: {String(v)}
                </Text>
              ))}
            </BlockStack>
          </Card>
        )}

        {rows.length > 0 && (
          <DataTableWithTotals
            headings={columns}
            rows={tableRows}
            totals={footerTotals}
          />
        )}
      </BlockStack>
    </Page>
  );
}
