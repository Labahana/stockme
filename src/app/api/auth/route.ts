import { NextRequest, NextResponse } from "next/server";
import { loadOfflineSession, sanitizeShop } from "@/lib/shopify";
import { isLegacyNonExpiringSession } from "@/lib/shopify/oauth";
import { beginOfflineOAuth } from "@/lib/shopify/oauth";

export const dynamic = "force-dynamic";

/**
 * App URL entry for Partner Dashboard / App Store automated checks.
 * Must immediately start OAuth (302) — no UI before authentication.
 * If an offline session already exists, send the merchant into the embedded app.
 */
export async function GET(request: NextRequest) {
  try {
    const shopParam = request.nextUrl.searchParams.get("shop");
    const host = request.nextUrl.searchParams.get("host");
    const shop = sanitizeShop(shopParam);

    if (!shop) {
      // Prefer HTML over JSON 400 — bare App URL probes should not look "broken".
      const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>Stockme</title></head>
<body style="font-family:system-ui;padding:2rem;max-width:36rem;margin:2rem auto">
  <h1>Stockme</h1>
  <p>Open this app from your Shopify Admin to install or launch it for a store.</p>
</body></html>`;
      return new NextResponse(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const session = await loadOfflineSession(shop);
    if (session?.accessToken && !isLegacyNonExpiringSession(session)) {
      // App URL is loaded inside the Admin iframe. Stay same-origin so we do
      // not navigate the iframe to admin.shopify.com (often refuses framing).
      const appUrl =
        process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
        "https://stockme.gentletap.co";
      const params = new URLSearchParams({ shop });
      if (host) params.set("host", host);
      return NextResponse.redirect(`${appUrl}/app?${params.toString()}`);
    }

    const { redirectUrl } = await beginOfflineOAuth(shop);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("OAuth begin error:", error);
    const message = error instanceof Error ? error.message : "OAuth begin failed";
    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>Stockme</title></head>
<body style="font-family:system-ui;padding:2rem;max-width:36rem;margin:2rem auto">
  <h1>Could not start Stockme install</h1>
  <p>${message.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>
  <p>Return to Shopify Admin and open Stockme again.</p>
</body></html>`;
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
