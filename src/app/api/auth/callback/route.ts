import { NextRequest, NextResponse } from "next/server";
import {
  ensureStoreRecord,
  registerWebhooks,
  shopify,
  storeSession,
} from "@/lib/shopify";
import { syncStoreBilling } from "@/lib/billing/plans";
import { completeOfflineOAuth } from "@/lib/shopify/oauth";
import { inngest } from "@/lib/inngest/client";
import { BILLING_DISABLED_FOR_DEMO } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session, shop } = await completeOfflineOAuth(request.nextUrl.searchParams);

    await storeSession(session);
    const store = await ensureStoreRecord(shop);

    // DEMO: mark store active/pro so API checks pass without a subscription
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
        console.error("Billing sync after OAuth failed:", billingError);
      }
    }

    try {
      await registerWebhooks(session);
    } catch (webhookError) {
      console.error("Webhook registration failed:", webhookError);
    }

    // Only queue via Inngest here — never block the OAuth redirect on a long
    // catalog sync. Force sync from Inventory/Home runs inline when needed.
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

    const host = request.nextUrl.searchParams.get("host");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://stockme.gentletap.co";
    // DEMO: skip billing=required redirect — go straight into the app
    const redirectUrl = host
      ? await shopify.auth.buildEmbeddedAppUrl(host)
      : BILLING_DISABLED_FOR_DEMO
        ? `${appUrl}/app?shop=${encodeURIComponent(shop)}`
        : `${appUrl}/app/settings?shop=${encodeURIComponent(shop)}&billing=required`;

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("OAuth callback error:", error);
    const message = error instanceof Error ? error.message : "OAuth callback failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
