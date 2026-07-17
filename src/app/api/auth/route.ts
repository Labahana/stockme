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
      return NextResponse.json({ error: "Invalid shop parameter" }, { status: 400 });
    }

    const session = await loadOfflineSession(shop);
    if (session?.accessToken && !isLegacyNonExpiringSession(session)) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
