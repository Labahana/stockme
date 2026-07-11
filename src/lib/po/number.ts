import { createAdminClient } from "@/lib/supabase/admin";

export async function nextPoNumber(shopId: string) {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("purchase_orders")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId);

  if (error) throw error;
  const seq = (count ?? 0) + 1;
  return `PO-${String(seq).padStart(5, "0")}`;
}

export async function nextTransferNumber(shopId: string) {
  const supabase = createAdminClient();
  const { count, error } = await supabase
    .from("stock_transfers")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shopId);

  if (error) throw error;
  const seq = (count ?? 0) + 1;
  return `TR-${String(seq).padStart(5, "0")}`;
}
