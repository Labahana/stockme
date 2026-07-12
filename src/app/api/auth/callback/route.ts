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
    // web-api adapter reads Cookie from NextRequest correctly and returns
    // { session, headers } where headers is a Fetch Headers (clears state cookie).
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
      : `${process.env.NEXT_PUBLIC_APP_URL ?? "https://stocky-rho.vercel.app"}/app/settings?shop=${encodeURIComponent(callback.session.shop)}&billing=required`;

    const redirect = NextResponse.redirect(redirectUrl);

    // Preserve any Set-Cookie headers from the OAuth callback (clears state).
    const oauthHeaders = callback.headers as Headers;
    if (oauthHeaders && typeof oauthHeaders.getSetCookie === "function") {
      for (const cookie of oauthHeaders.getSetCookie()) {
        redirect.headers.append("Set-Cookie", cookie);
      }
    } else if (oauthHeaders) {
      const setCookie = oauthHeaders.get("Set-Cookie");
      if (setCookie) redirect.headers.append("Set-Cookie", setCookie);
    }

    return redirect;
  } catch (error) {
    console.error("OAuth callback error:", error);
    const message = error instanceof Error ? error.message : "OAuth callback failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
