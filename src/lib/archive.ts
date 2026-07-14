import { createAdminClient } from "@/lib/supabase/admin";
import { gunzipSync, gzipSync } from "zlib";

async function ensureArchivesBucket() {
  const supabase = createAdminClient();
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.id === "archives" || b.name === "archives");
  if (exists) return;

  const { error } = await supabase.storage.createBucket("archives", {
    public: false,
    fileSizeLimit: 52_428_800,
  });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`Could not create archives bucket: ${error.message}`);
  }
}

/**
 * Archive received POs older than `daysOld` into Supabase Storage as gzip JSON,
 * then delete from Postgres to reclaim free-tier DB space.
 */
export async function archiveOldPurchaseOrders(
  shopId: string,
  daysOld = 90,
): Promise<{ archived: number; bytesFreed: number; path?: string }> {
  const supabase = createAdminClient();
  await ensureArchivesBucket();

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
  const path = `${shopId}/pos-${Date.now()}.json.gz`;

  const { error: uploadError } = await supabase.storage
    .from("archives")
    .upload(path, compressed, {
      contentType: "application/gzip",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Archive upload failed: ${uploadError.message}`);
  }

  // Cascades handle receipts/lines when purchase_orders row is deleted
  const poIds = oldPOs.map((po) => po.id);
  const { error: deleteError } = await supabase
    .from("purchase_orders")
    .delete()
    .in("id", poIds);

  if (deleteError) {
    throw new Error(`Archive uploaded but DB delete failed: ${deleteError.message}`);
  }

  return { archived: oldPOs.length, bytesFreed: json.length, path };
}

/** Archive old received POs for every store (daily maintenance / free-tier). */
export async function archiveOldPurchaseOrdersForAllShops(daysOld = 90) {
  const supabase = createAdminClient();
  const { data: stores, error } = await supabase.from("stores").select("id");
  if (error) throw error;

  let archived = 0;
  let bytesFreed = 0;
  const errors: string[] = [];

  for (const store of stores ?? []) {
    try {
      const result = await archiveOldPurchaseOrders(store.id, daysOld);
      archived += result.archived;
      bytesFreed += result.bytesFreed;
    } catch (err) {
      errors.push(
        `${store.id}: ${err instanceof Error ? err.message : "archive failed"}`,
      );
    }
  }

  return { archived, bytesFreed, shops: stores?.length ?? 0, errors };
}

export async function restoreArchivedPurchaseOrders(archivePath: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from("archives").download(archivePath);
  if (error) throw error;

  const compressed = Buffer.from(await data.arrayBuffer());
  const json = gunzipSync(compressed).toString("utf8");
  return JSON.parse(json) as unknown[];
}
