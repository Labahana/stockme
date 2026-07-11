import { NextRequest, NextResponse } from "next/server";
import { sanitizeShop, shopify } from "@/lib/shopify";
import { createRawResponse, toNextResponse } from "@/lib/shopify/next-adapter";

export const dynamic = "force-dynamic";

async function beginAuth(request: NextRequest, shop: string) {
  const rawResponse = createRawResponse();

  await shopify.auth.begin({
    shop,
    callbackPath: "/api/auth/callback",
    isOnline: false,
    rawRequest: request,
    rawResponse,
  });

  return toNextResponse(rawResponse);
}

export async function GET(request: NextRequest) {
  try {
    const shop = sanitizeShop(request.nextUrl.searchParams.get("shop"));

    if (!shop) {
      return NextResponse.json({ error: "Invalid shop parameter" }, { status: 400 });
    }

    return await beginAuth(request, shop);
  } catch (error) {
    console.error("OAuth begin error:", error);
    return NextResponse.json({ error: "OAuth begin failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
