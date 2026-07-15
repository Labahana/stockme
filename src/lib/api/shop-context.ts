import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadOfflineSession, sanitizeShop } from "@/lib/shopify";
import { billingBypassEnabled } from "@/lib/billing/plans";
import {
  bearerFromRequest,
  shopFromSessionToken,
} from "@/lib/shopify/session-token";

export type ShopContext = {
  shop: string;
  store: import("@/lib/types/database").Store;
};

export type ResolveShopOptions = {
  /** Allow access without an active Shopify subscription (billing/settings). */
  skipBilling?: boolean;
  /**
   * Skip App Bridge session-token check (webhooks/cron/internal only).
   * Browser API calls from the embedded app must send Authorization: Bearer <idToken>.
   */
  skipSessionToken?: boolean;
};

async function resolveShopDomain(
  request: NextRequest,
  options?: ResolveShopOptions,
): Promise<string | NextResponse> {
  const token = bearerFromRequest(request.headers.get("authorization"));
  const queryShop = sanitizeShop(request.nextUrl.searchParams.get("shop"));

  if (token) {
    try {
      const shopFromToken = await shopFromSessionToken(token);
      if (!shopFromToken) {
        return NextResponse.json({ error: "Invalid session token shop" }, { status: 401 });
      }
      if (queryShop && queryShop !== shopFromToken) {
        return NextResponse.json(
          { error: "Shop mismatch between session token and query" },
          { status: 401 },
        );
      }
      return shopFromToken;
    } catch (error) {
      console.error("Session token validation failed:", error);
      return NextResponse.json({ error: "Invalid session token" }, { status: 401 });
    }
  }

  if (options?.skipSessionToken) {
    if (!queryShop) {
      return NextResponse.json({ error: "Missing or invalid shop" }, { status: 400 });
    }
    return queryShop;
  }

  // Embedded admin requests must include a session token (App Bridge idToken).
  // Allow query-only in non-production for local scripts, or when explicitly enabled.
  const allowQueryOnly =
    process.env.STOCKME_ALLOW_QUERY_SHOP_AUTH === "true" ||
    process.env.NODE_ENV === "development";

  if (allowQueryOnly && queryShop) {
    return queryShop;
  }

  return NextResponse.json(
    {
      error: "Missing App Bridge session token",
      code: "SESSION_TOKEN_REQUIRED",
    },
    { status: 401 },
  );
}

export async function resolveShopContext(
  request: NextRequest,
  options?: ResolveShopOptions,
): Promise<ShopContext | NextResponse> {
  const shopOrError = await resolveShopDomain(request, options);
  if (isNextResponse(shopOrError)) return shopOrError;
  const shop = shopOrError;

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

  if (
    !options?.skipBilling &&
    store.billing_status !== "active" &&
    !billingBypassEnabled()
  ) {
    return NextResponse.json(
      {
        error: "An active Shopify subscription is required. Choose a plan in Settings.",
        code: "BILLING_REQUIRED",
      },
      { status: 402 },
    );
  }

  return { shop, store };
}

export function isNextResponse(value: unknown): value is NextResponse {
  return value instanceof NextResponse;
}
