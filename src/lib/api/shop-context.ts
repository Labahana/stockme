import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadOfflineSession, sanitizeShop } from "@/lib/shopify";
// import { billingBypassEnabled } from "@/lib/billing/plans";

export type ShopContext = {
  shop: string;
  store: import("@/lib/types/database").Store;
};

export type ResolveShopOptions = {
  /** Allow access without an active Shopify subscription (billing/settings). */
  skipBilling?: boolean;
};

export async function resolveShopContext(
  request: NextRequest,
  _options?: ResolveShopOptions,
): Promise<ShopContext | NextResponse> {
  void _options;
  const shop = sanitizeShop(request.nextUrl.searchParams.get("shop"));

  if (!shop) {
    return NextResponse.json({ error: "Missing or invalid shop" }, { status: 400 });
  }

  const session = await loadOfflineSession(shop);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "App not installed for this shop" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: store, error } = await supabase
    .from("stores")
    .select("*")
    .eq("shop_domain", shop)
    .maybeSingle();

  if (error) throw error;
  if (!store) {
    return NextResponse.json({ error: "Store record not found" }, { status: 404 });
  }

  // Billing enforcement disabled for initial dev/testing. Uncomment when billing
  // is configured (public app distribution + Shopify App Pricing / Billing API).
  // if (!options?.skipBilling && store.billing_status !== "active" && !billingBypassEnabled()) {
  //   return NextResponse.json(
  //     {
  //       error: "An active Shopify subscription is required. Choose a plan in Settings.",
  //       code: "BILLING_REQUIRED",
  //     },
  //     { status: 402 },
  //   );
  // }

  return { shop, store };
}

export function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
