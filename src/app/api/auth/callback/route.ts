import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import {
  ensureStoreRecord,
  registerWebhooks,
  shopify,
  storeSession,
  loadOfflineSession,
} from "@/lib/shopify";
import { syncStoreBilling } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const callback = await shopify.auth.callback({
      rawRequest: request,
      expiring: true,
    });

    await storeSession(callback.session);
    const store = await ensureStoreRecord(callback.session.shop);

    const offlineSession = callback.session.isOnline
      ? await loadOfflineSession(callback.session.shop)
      : callback.session;

    if (offlineSession) {
      await syncStoreBilling(offlineSession, store.id);
    }

    try {
      await registerWebhooks(callback.session);
    } catch (webhookError) {
      console.error("Webhook registration failed:", webhookError);
    }

    try {
      await inngest.send({
        name: "shopify/sync.full",
        data: { shop: callback.session.shop, force: true },
      });
    } catch (syncError) {
      console.error("Initial sync queue failed:", syncError);
    }

    const host = request.nextUrl.searchParams.get("host");
    const redirectUrl = host
      ? await shopify.auth.buildEmbeddedAppUrl(host)
      : `${process.env.NEXT_PUBLIC_APP_URL}/app/settings?shop=${encodeURIComponent(callback.session.shop)}&billing=required`;

    const response = NextResponse.redirect(redirectUrl);
    for (const [key, value] of Object.entries(callback.headers)) {
      if (typeof value === "string") {
        response.headers.set(key, value);
      }
    }
    return response;
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.json(
      { error: "OAuth callback failed" },
      { status: 500 },
    );
  }
}
