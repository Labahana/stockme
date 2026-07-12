import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import {
  ensureStoreRecord,
  registerWebhooks,
  shopify,
  storeSession,
} from "@/lib/shopify";
import { syncStoreBilling } from "@/lib/billing/plans";
import { completeOfflineOAuth } from "@/lib/shopify/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { session, shop } = await completeOfflineOAuth(request.nextUrl.searchParams);

    await storeSession(session);
    const store = await ensureStoreRecord(shop);

    try {
      await syncStoreBilling(session, store.id);
    } catch (billingError) {
      console.error("Billing sync after OAuth failed:", billingError);
    }

    try {
      await registerWebhooks(session);
    } catch (webhookError) {
      console.error("Webhook registration failed:", webhookError);
    }

    try {
      await inngest.send({
        name: "shopify/sync.full",
        data: { shop, force: true },
      });
    } catch (syncError) {
      console.error("Initial sync queue failed:", syncError);
    }

    const host = request.nextUrl.searchParams.get("host");
    const redirectUrl = host
      ? await shopify.auth.buildEmbeddedAppUrl(host)
      : `${process.env.NEXT_PUBLIC_APP_URL ?? "https://stocky-rho.vercel.app"}/app/settings?shop=${encodeURIComponent(shop)}&billing=required`;

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("OAuth callback error:", error);
    const message = error instanceof Error ? error.message : "OAuth callback failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
