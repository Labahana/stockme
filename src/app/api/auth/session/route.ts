import { NextRequest, NextResponse } from "next/server";
import {
  ensureStoreRecord,
  loadOfflineSession,
  registerWebhooks,
  sanitizeShop,
  storeSession,
} from "@/lib/shopify";
import {
  exchangeSessionTokenForOffline,
  isLegacyNonExpiringSession,
} from "@/lib/shopify/oauth";
import {
  bearerFromRequest,
  shopFromSessionToken,
} from "@/lib/shopify/session-token";
import { syncStoreBilling } from "@/lib/billing/plans";
import { inngest } from "@/lib/inngest/client";
import { BILLING_DISABLED_FOR_DEMO } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Bootstrap offline session after Shopify managed install.
 * Client sends App Bridge idToken; we token-exchange for an expiring offline token.
 */
export async function POST(request: NextRequest) {
  try {
    const token = bearerFromRequest(request.headers.get("authorization"));
    if (!token) {
      return NextResponse.json(
        { error: "Missing App Bridge session token", code: "SESSION_TOKEN_REQUIRED" },
        { status: 401 },
      );
    }

    const shopFromToken = await shopFromSessionToken(token);
    const shopQuery = sanitizeShop(request.nextUrl.searchParams.get("shop"));
    const shop = shopFromToken ?? shopQuery;
    if (!shop) {
      return NextResponse.json({ error: "Invalid shop" }, { status: 400 });
    }
    if (shopQuery && shopFromToken && shopQuery !== shopFromToken) {
      return NextResponse.json({ error: "Shop mismatch" }, { status: 401 });
    }

    const existing = await loadOfflineSession(shop);
    if (existing?.accessToken && !isLegacyNonExpiringSession(existing)) {
      return NextResponse.json({ ok: true, shop, alreadyInstalled: true });
    }

    const session = await exchangeSessionTokenForOffline(shop, token);
    await storeSession(session);
    const store = await ensureStoreRecord(shop);

    if (BILLING_DISABLED_FOR_DEMO) {
      try {
        const supabase = createAdminClient();
        await supabase
          .from("stores")
          .update({ billing_status: "active", plan_tier: "pro" })
          .eq("id", store.id);
      } catch (e) {
        console.error("Demo billing activate failed:", e);
      }
    } else {
      try {
        await syncStoreBilling(session, store.id);
      } catch (billingError) {
        console.error("Billing sync after token exchange failed:", billingError);
      }
    }

    try {
      await registerWebhooks(session);
    } catch (webhookError) {
      console.error("Webhook registration failed:", webhookError);
    }

    if (process.env.INNGEST_EVENT_KEY?.trim()) {
      try {
        await inngest.send({
          name: "shopify/sync.full",
          data: { shop, force: true },
        });
      } catch (syncError) {
        console.error("Initial sync queue failed:", syncError);
      }
    }

    return NextResponse.json({ ok: true, shop, installed: true });
  } catch (error) {
    console.error("Session token bootstrap failed:", error);
    const message = error instanceof Error ? error.message : "Bootstrap failed";
    return NextResponse.json({ error: message, code: "BOOTSTRAP_FAILED" }, { status: 500 });
  }
}
