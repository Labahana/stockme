import { NextRequest, NextResponse } from "next/server";
import {
  ensureStoreRecord,
  registerWebhooks,
  storeSession,
} from "@/lib/shopify";
import { syncStoreBilling } from "@/lib/billing/plans";
import { completeOfflineOAuth } from "@/lib/shopify/oauth";
import { postInstallAdminUrl } from "@/lib/shopify/post-install-redirect";
import { inngest } from "@/lib/inngest/client";
import { BILLING_DISABLED_FOR_DEMO } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeShop } from "@/lib/shopify";

export const dynamic = "force-dynamic";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Never return JSON 500 after OAuth — App Store treats that as a failed UI (2.1.3). */
function oauthErrorPage(shop: string | null, message: string) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://stockme.gentletap.co";
  const retry = shop
    ? `${appUrl}/api/auth?shop=${encodeURIComponent(shop)}`
    : appUrl;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Stockme — Install interrupted</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 36rem; margin: 3rem auto; padding: 0 1.25rem; color: #202223; line-height: 1.5; }
    a.button { display: inline-block; margin-top: 1rem; background: #008060; color: #fff; text-decoration: none; padding: 0.75rem 1.25rem; border-radius: 8px; font-weight: 600; }
    .detail { color: #6d7175; font-size: 0.95rem; }
  </style>
</head>
<body>
  <h1>Stockme install interrupted</h1>
  <p>Something went wrong finishing the connection to your Shopify store. This is usually fixed by trying install once more from Admin.</p>
  <p class="detail">${escapeHtml(message)}</p>
  <p><a class="button" href="${escapeHtml(retry)}">Try installing again</a></p>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  const shopHint = sanitizeShop(request.nextUrl.searchParams.get("shop"));

  // Automated probes / bare callback hits must not return 500 JSON.
  if (
    !request.nextUrl.searchParams.get("code") ||
    !request.nextUrl.searchParams.get("state")
  ) {
    return oauthErrorPage(
      shopHint,
      "Missing OAuth code/state. Open Stockme from Shopify Admin to install.",
    );
  }

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
    // Always re-enter Admin embedded UI. BillingGuard will send unpaid shops
    // to Settings once App Bridge session tokens work inside the iframe.
    const redirectUrl = await postInstallAdminUrl(shop, host);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("OAuth callback error:", error);
    const message = error instanceof Error ? error.message : "OAuth callback failed";
    return oauthErrorPage(shopHint, message);
  }
}
