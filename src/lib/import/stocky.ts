import { parseCsv } from "@/lib/import/csv";
import {
  importPurchaseOrderRows,
  importSupplierRows,
} from "@/lib/import/chunk-import";

export type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
};

export async function importStockySuppliers(
  shopId: string,
  csvText: string,
): Promise<ImportResult> {
  return importSupplierRows(shopId, parseCsv(csvText));
}

export async function importStockyPurchaseOrders(
  shopId: string,
  csvText: string,
  options: { createMissingSuppliers?: boolean } = {},
): Promise<ImportResult> {
  return importPurchaseOrderRows(shopId, parseCsv(csvText), options);
}
