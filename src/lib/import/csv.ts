/** Minimal RFC4180-style CSV parser for Stocky migration uploads. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };

  const pushRow = () => {
    if (row.length > 0 || field.length > 0) {
      pushField();
      rows.push(row);
      row = [];
    }
  };

  const normalized = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n") {
      pushField();
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  pushRow();

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return [];

  const headers = nonEmpty[0].map((h) => h.trim());
  return nonEmpty.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = (cells[idx] ?? "").trim();
    });
    return record;
  });
}

function normalizeKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export function pickField(row: Record<string, string>, aliases: string[]): string {
  const normalized = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [normalizeKey(k), v]),
  );
  for (const alias of aliases) {
    const val = normalized[normalizeKey(alias)];
    if (val?.trim()) return val.trim();
  }
  return "";
}

export function parseInteger(value: string, fallback = 0) {
  const n = Number.parseInt(value.replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function parseDecimal(value: string, fallback = 0) {
  const cleaned = value.replace(/[$,\s]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

export const SUPPLIER_SAMPLE_CSV = `name,contact_name,email,phone,address,lead_time_days,notes
Acme Wholesale,Jane Doe,jane@acme.com,555-0100,"123 Supply St",7,Primary vendor
`;

export const PO_SAMPLE_CSV = `po_number,supplier,location,status,sku,product,variant,ordered_qty,received_qty,unit_cost,notes,expected_at
STK-PO-1001,Acme Wholesale,Main Warehouse,received,SKU-001,Widget A,Default Title,50,50,12.50,Stocky import,2026-03-01
STK-PO-1001,Acme Wholesale,Main Warehouse,received,SKU-002,Widget B,Default Title,20,15,8.00,Stocky import,2026-03-01
STK-PO-1002,Acme Wholesale,Main Warehouse,sent,SKU-003,Gadget C,Default Title,100,0,5.25,,2026-04-15
`;
