import { NextRequest, NextResponse } from "next/server";
import { loadOfflineSession, sanitizeShop } from "@/lib/shopify";
import { isLegacyNonExpiringSession } from "@/lib/shopify/oauth";
import { beginOfflineOAuth } from "@/lib/shopify/oauth";

export const dynamic = "force-dynamic";

/**
 * App URL entry (Partner Dashboard / managed install).
 *
 * With managed installation (use_legacy_install_flow = false), Shopify grants
 * scopes without hitting /api/auth/callback. This route must load the embedded
 * UI — not kick off authorization-code OAuth — or reviewers see a broken app
 * after install (App Store 2.1.3).
 *
 * Offline tokens are created via POST /api/auth/session (token exchange).
 * Pass ?oauth=1 to force the legacy authorization-code flow (reconnect).
 */
export async function GET(request: NextRequest) {
  try {
    const shopParam = request.nextUrl.searchParams.get("shop");
    const host = request.nextUrl.searchParams.get("host");
    const forceOAuth = request.nextUrl.searchParams.get("oauth") === "1";
    const shop = sanitizeShop(shopParam);

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
      "https://stockme.gentletap.co";

    if (!shop) {
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
    const installed =
      Boolean(session?.accessToken) && !isLegacyNonExpiringSession(session!);

    // Embedded launch (shop + host): always enter the app UI.
    if (host && !forceOAuth) {
      const params = new URLSearchParams({ shop, host });
      return NextResponse.redirect(`${appUrl}/app?${params.toString()}`);
    }

    // Already installed without host — enter app.
    if (installed && !forceOAuth) {
      const params = new URLSearchParams({ shop });
      return NextResponse.redirect(`${appUrl}/app?${params.toString()}`);
    }

    // Explicit reconnect / non-embedded install fallback.
    const { redirectUrl } = await beginOfflineOAuth(shop);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error("OAuth begin error:", error);
    const message = error instanceof Error ? error.message : "OAuth begin failed";
    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>Stockme</title></head>
<body style="font-family:system-ui;padding:2rem;max-width:36rem;margin:2rem auto">
  <h1>Could not start Stockme</h1>
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
