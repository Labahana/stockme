import { NextRequest, NextResponse } from "next/server";
import { beginOfflineOAuth } from "@/lib/shopify/oauth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const shopParam = request.nextUrl.searchParams.get("shop");
    if (!shopParam) {
      return NextResponse.json({ error: "Invalid shop parameter" }, { status: 400 });
    }

    const { redirectUrl } = await beginOfflineOAuth(shopParam);
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
