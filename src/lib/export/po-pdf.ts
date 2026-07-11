import { jsPDF } from "jspdf";

type PoLine = {
  ordered_qty: number;
  received_qty: number;
  unit_cost: number;
  variants: { sku: string | null; title: string; barcode: string | null } | { sku: string | null; title: string; barcode: string | null }[];
};

export type PoDetail = {
  po_number: string;
  status: string;
  notes: string | null;
  expected_at: string | null;
  sent_at: string | null;
  suppliers: { name: string; email: string | null } | { name: string; email: string | null }[];
  locations: { name: string } | { name: string }[];
  po_line_items: PoLine[];
};

function rel<T>(value: T | T[]): T {
  return Array.isArray(value) ? value[0] : value;
}

function buildPurchaseOrderPdf(po: PoDetail) {
  const doc = new jsPDF();
  const supplier = rel(po.suppliers);
  const location = rel(po.locations);
  let y = 18;

  doc.setFontSize(16);
  doc.text(`Purchase Order ${po.po_number}`, 14, y);
  y += 10;

  doc.setFontSize(10);
  doc.text(`Status: ${po.status}`, 14, y);
  y += 6;
  doc.text(`Supplier: ${supplier?.name ?? "—"}`, 14, y);
  y += 6;
  if (supplier?.email) {
    doc.text(`Email: ${supplier.email}`, 14, y);
    y += 6;
  }
  doc.text(`Location: ${location?.name ?? "—"}`, 14, y);
  y += 6;
  if (po.sent_at) {
    doc.text(`Sent: ${new Date(po.sent_at).toLocaleDateString()}`, 14, y);
    y += 6;
  }
  if (po.expected_at) {
    doc.text(`Expected: ${po.expected_at}`, 14, y);
    y += 6;
  }
  if (po.notes) {
    doc.text(`Notes: ${po.notes}`, 14, y);
    y += 6;
  }

  y += 4;
  doc.setFontSize(11);
  doc.text("Line items", 14, y);
  y += 8;

  doc.setFontSize(9);
  doc.text("SKU / Title", 14, y);
  doc.text("Ordered", 120, y);
  doc.text("Received", 145, y);
  doc.text("Unit cost", 170, y);
  y += 5;
  doc.line(14, y, 196, y);
  y += 6;

  for (const line of po.po_line_items ?? []) {
    const variant = rel(line.variants);
    const label = variant?.sku ? `${variant.sku} — ${variant.title}` : variant?.title ?? "—";
    const wrapped = doc.splitTextToSize(label, 95);
    doc.text(wrapped, 14, y);
    doc.text(String(line.ordered_qty), 120, y);
    doc.text(String(line.received_qty), 145, y);
    doc.text(`$${Number(line.unit_cost).toFixed(2)}`, 170, y);
    y += wrapped.length * 5 + 2;

    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  }

  return doc;
}

export function downloadPurchaseOrderPdf(po: PoDetail) {
  const doc = buildPurchaseOrderPdf(po);
  doc.save(`${po.po_number}.pdf`);
}

export function purchaseOrderPdfBase64(po: PoDetail) {
  const doc = buildPurchaseOrderPdf(po);
  return Buffer.from(doc.output("arraybuffer")).toString("base64");
}
