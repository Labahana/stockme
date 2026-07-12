import { createAdminClient } from "@/lib/supabase/admin";
import { gzipSync } from "zlib";

/**
 * Archive received POs older than `daysOld` into Supabase Storage as gzip JSON,
 * then delete from Postgres to reclaim free-tier DB space.
 */
export async function archiveOldPurchaseOrders(
  shopId: string,
  daysOld = 90,
): Promise<{ archived: number; bytesFreed: number; path?: string }> {
  const supabase = createAdminClient();
  const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

  const { data: oldPOs, error } = await supabase
    .from("purchase_orders")
    .select(
      `*, po_line_items(*), po_receipts(*, po_receipt_lines(*), po_receipt_invoices(*))`,
    )
    .eq("shop_id", shopId)
    .eq("status", "received")
    .lt("created_at", cutoff)
    .limit(200);

  if (error) throw error;
  if (!oldPOs || oldPOs.length === 0) return { archived: 0, bytesFreed: 0 };

  const json = JSON.stringify(oldPOs);
  const compressed = gzipSync(Buffer.from(json));
  const path = `archives/${shopId}/pos-${Date.now()}.json.gz`;

  const { error: uploadError } = await supabase.storage
    .from("archives")
    .upload(path, compressed, {
      contentType: "application/gzip",
      upsert: false,
    });

  if (uploadError) {
    // Bucket may not exist yet — don't delete rows if upload failed
    throw new Error(`Archive upload failed: ${uploadError.message}`);
  }

  const poIds = oldPOs.map((po) => po.id);
  await supabase.from("po_line_items").delete().in("purchase_order_id", poIds);
  await supabase.from("purchase_orders").delete().in("id", poIds);

  return { archived: oldPOs.length, bytesFreed: json.length, path };
}
