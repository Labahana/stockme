import { createAdminClient } from "@/lib/supabase/admin";

/** GDPR shop/redact — delete all merchant data for a uninstalled shop. */
export async function redactShopData(shopDomain: string) {
  const supabase = createAdminClient();

  const { data: store } = await supabase
    .from("stores")
    .select("id")
    .eq("shop_domain", shopDomain)
    .maybeSingle();

  if (store) {
    await supabase.from("stores").delete().eq("id", store.id);
  }

  await supabase.from("shopify_sessions").delete().eq("shop", shopDomain);
}
