"use client";

import { Card, DataTable, Text } from "@shopify/polaris";

type ColumnType = "text" | "numeric";

/**
 * Numeric tables always show footer totals — Stocky bug #7 fix.
 */
export function DataTableWithTotals({
  headings,
  rows,
  columnTypes,
  totals,
  totalsLabel = "Totals",
}: {
  headings: string[];
  rows: string[][];
  columnTypes?: ColumnType[];
  totals: (string | number | null | undefined)[];
  totalsLabel?: string;
}) {
  const types: ColumnType[] =
    columnTypes ?? headings.map((_, i) => (i === 0 ? "text" : "numeric"));

  const footer = totals.map((v, i) => {
    if (i === 0) return totalsLabel;
    if (v == null || v === "") return "";
    return String(v);
  });

  return (
    <Card padding="0">
      <DataTable
        columnContentTypes={types}
        headings={headings}
        rows={rows}
        totals={footer}
        showTotalsInFooter
      />
      {rows.length === 0 && (
        <div style={{ padding: 16 }}>
          <Text as="p" tone="subdued">
            No rows
          </Text>
        </div>
      )}
    </Card>
  );
}
