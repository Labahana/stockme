import { createAdminClient } from "@/lib/supabase/admin";
import { parseCsv, pickField, parseInteger, parseDecimal } from "@/lib/import/csv";

export type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
};

function mapPoStatus(raw: string): "draft" | "sent" | "partially_received" | "received" | "cancelled" {
  const s = raw.toLowerCase().replace(/\s+/g, "_");
  if (s.includes("partial")) return "partially_received";
  if (s.includes("receive") && !s.includes("partial")) return "received";
  if (s.includes("sent") || s.includes("open")) return "sent";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("draft")) return "draft";
  if (s.includes("complete") || s.includes("closed")) return "received";
  return "draft";
}

export async function importStockySuppliers(
  shopId: string,
  csvText: string,
): Promise<ImportResult> {
  const rows = parseCsv(csvText);
  const supabase = createAdminClient();
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  const { data: existing } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("shop_id", shopId);

  const byName = new Map(
    (existing ?? []).map((s) => [s.name.trim().toLowerCase(), s.id]),
  );

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = pickField(row, ["name", "supplier", "supplier_name", "company"]);
    if (!name) {
      result.skipped++;
      result.errors.push(`Row ${i + 2}: missing supplier name`);
      continue;
    }

    const payload = {
      shop_id: shopId,
      name,
      contact_name: pickField(row, ["contact_name", "contact", "contact person"]) || null,
      email: pickField(row, ["email", "email_address"]) || null,
      phone: pickField(row, ["phone", "telephone", "mobile"]) || null,
      address: pickField(row, ["address", "street", "location"]) || null,
      lead_time_days: parseInteger(
        pickField(row, ["lead_time_days", "lead_time", "lead days", "leadtime"]),
        7,
      ),
      notes: pickField(row, ["notes", "note", "payment_terms", "terms"]) || null,
    };

    const key = name.toLowerCase();
    const existingId = byName.get(key);
    if (existingId) {
      const { error } = await supabase.from("suppliers").update(payload).eq("id", existingId);
      if (error) {
        result.errors.push(`Row ${i + 2}: ${error.message}`);
        result.skipped++;
      } else {
        result.updated++;
      }
    } else {
      const { data, error } = await supabase.from("suppliers").insert(payload).select("id").single();
      if (error) {
        result.errors.push(`Row ${i + 2}: ${error.message}`);
        result.skipped++;
      } else {
        byName.set(key, data.id);
        result.created++;
      }
    }
  }

  return result;
}

type PoLineInput = {
  sku: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
  productTitle?: string;
  variantTitle?: string;
};

type PoGroup = {
  poNumber: string;
  supplierName: string;
  locationName: string;
  status: ReturnType<typeof mapPoStatus>;
  notes: string;
  expectedAt: string | null;
  lines: PoLineInput[];
};

export async function importStockyPurchaseOrders(
  shopId: string,
  csvText: string,
  options: { createMissingSuppliers?: boolean } = {},
): Promise<ImportResult> {
  const rows = parseCsv(csvText);
  const supabase = createAdminClient();
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("shop_id", shopId);
  const supplierByName = new Map(
    (suppliers ?? []).map((s) => [s.name.trim().toLowerCase(), s.id]),
  );

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, is_primary")
    .eq("shop_id", shopId)
    .eq("active", true);
  const locationByName = new Map(
    (locations ?? []).map((l) => [l.name.trim().toLowerCase(), l.id]),
  );
  const primaryLocation =
    locations?.find((l) => l.is_primary)?.id ?? locations?.[0]?.id ?? null;

  const { data: variants } = await supabase
    .from("variants")
    .select("id, sku")
    .eq("shop_id", shopId);
  const variantBySku = new Map<string, string>();
  for (const v of variants ?? []) {
    if (v.sku?.trim()) variantBySku.set(v.sku.trim().toLowerCase(), v.id);
  }

  const groups = new Map<string, PoGroup>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const poNumber = pickField(row, [
      "po_number",
      "po number",
      "purchase_order",
      "purchase order",
      "number",
      "po",
      "id",
    ]);
    if (!poNumber) {
      result.skipped++;
      result.errors.push(`Row ${i + 2}: missing PO number`);
      continue;
    }

    const sku = pickField(row, ["sku", "variant_sku", "product_sku", "item_sku"]);
    if (!sku) {
      result.skipped++;
      result.errors.push(`Row ${i + 2} (${poNumber}): missing SKU`);
      continue;
    }

    const key = poNumber.toLowerCase();
    let group = groups.get(key);
    if (!group) {
      group = {
        poNumber,
        supplierName: pickField(row, ["supplier", "supplier_name", "vendor"]),
        locationName: pickField(row, ["location", "location_name", "warehouse", "destination"]),
        status: mapPoStatus(pickField(row, ["status", "po_status", "state"])),
        notes: pickField(row, ["notes", "note", "memo"]),
        expectedAt: pickField(row, ["expected_at", "expected_date", "expected delivery", "due_date"]) || null,
        lines: [],
      };
      groups.set(key, group);
    }

    group.lines.push({
      sku,
      orderedQty: parseInteger(
        pickField(row, ["ordered_qty", "ordered", "quantity_ordered", "qty_ordered", "quantity"]),
        0,
      ),
      receivedQty: parseInteger(
        pickField(row, ["received_qty", "received", "quantity_received", "qty_received"]),
        0,
      ),
      unitCost: parseDecimal(
        pickField(row, ["unit_cost", "cost", "unit price", "cost_price", "price"]),
        0,
      ),
      productTitle: pickField(row, ["product", "product_title", "title"]),
      variantTitle: pickField(row, ["variant", "variant_title"]),
    });
  }

  for (const group of Array.from(groups.values())) {
    if (!group.supplierName) {
      result.errors.push(`${group.poNumber}: missing supplier — skipped`);
      result.skipped++;
      continue;
    }

    let supplierId = supplierByName.get(group.supplierName.toLowerCase());
    if (!supplierId && options.createMissingSuppliers) {
      const { data, error } = await supabase
        .from("suppliers")
        .insert({ shop_id: shopId, name: group.supplierName })
        .select("id")
        .single();
      if (error) {
        result.errors.push(`${group.poNumber}: could not create supplier — ${error.message}`);
        result.skipped++;
        continue;
      }
      supplierId = data.id;
      supplierByName.set(group.supplierName.toLowerCase(), supplierId);
    }
    if (!supplierId) {
      result.errors.push(`${group.poNumber}: supplier "${group.supplierName}" not found`);
      result.skipped++;
      continue;
    }

    const locationId =
      (group.locationName
        ? locationByName.get(group.locationName.toLowerCase())
        : undefined) ?? primaryLocation;
    if (!locationId) {
      result.errors.push(`${group.poNumber}: no matching location — run catalog sync first`);
      result.skipped++;
      continue;
    }

    const lineRows: { variant_id: string; ordered_qty: number; received_qty: number; unit_cost: number }[] = [];
    for (const line of group.lines) {
      const variantId = variantBySku.get(line.sku.toLowerCase());
      if (!variantId) {
        result.errors.push(`${group.poNumber}: SKU "${line.sku}" not found in catalog`);
        continue;
      }
      if (line.orderedQty <= 0) continue;
      lineRows.push({
        variant_id: variantId,
        ordered_qty: line.orderedQty,
        received_qty: Math.min(line.receivedQty, line.orderedQty),
        unit_cost: line.unitCost,
      });
    }

    if (lineRows.length === 0) {
      result.errors.push(`${group.poNumber}: no valid line items`);
      result.skipped++;
      continue;
    }

    const { data: existingPo } = await supabase
      .from("purchase_orders")
      .select("id")
      .eq("shop_id", shopId)
      .eq("po_number", group.poNumber)
      .maybeSingle();

    if (existingPo) {
      result.updated++;
      continue;
    }

    const { data: po, error: poError } = await supabase
      .from("purchase_orders")
      .insert({
        shop_id: shopId,
        supplier_id: supplierId,
        location_id: locationId,
        po_number: group.poNumber,
        status: group.status,
        notes: group.notes ? `[Stocky import] ${group.notes}` : "[Stocky import]",
        expected_at: group.expectedAt || null,
        sent_at: group.status !== "draft" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (poError) {
      result.errors.push(`${group.poNumber}: ${poError.message}`);
      result.skipped++;
      continue;
    }

    const { error: lineError } = await supabase.from("po_line_items").insert(
      lineRows.map((l) => ({
        shop_id: shopId,
        purchase_order_id: po.id,
        variant_id: l.variant_id,
        ordered_qty: l.ordered_qty,
        received_qty: l.received_qty,
        unit_cost: l.unit_cost,
      })),
    );

    if (lineError) {
      result.errors.push(`${group.poNumber} lines: ${lineError.message}`);
      await supabase.from("purchase_orders").delete().eq("id", po.id);
      result.skipped++;
      continue;
    }

    result.created++;
  }

  return result;
}
