"use client";

import { Card, DataTable, Text } from "@shopify/polaris";
import type { ReactNode } from "react";

type ColumnType = "text" | "numeric";

/** Spec §15 — numeric tables always show footer totals. */
export function DataTableWithTotals({
  headings,
  rows,
  columnTypes,
  footerContent,
  totals,
  totalsLabel = "Totals",
  showTotalsInFooter = true,
}: {
  headings: string[];
  rows: string[][];
  columnTypes?: ColumnType[];
  footerContent?: ReactNode[];
  totals?: (string | number | null | undefined)[];
  totalsLabel?: string;
  showTotalsInFooter?: boolean;
}) {
  const types: ColumnType[] =
    columnTypes ?? headings.map((_, i) => (i === 0 ? "text" : "numeric"));

  const footer =
    footerContent ??
    (totals
      ? totals.map((v, i) => {
          if (i === 0) return totalsLabel;
          if (v == null || v === "") return "";
          return String(v);
        })
      : undefined);

  return (
    <Card padding="0">
      <DataTable
        columnContentTypes={types}
        headings={headings}
        rows={rows}
        totals={showTotalsInFooter && footer ? footer.map(String) : undefined}
        showTotalsInFooter={Boolean(showTotalsInFooter && footer)}
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
