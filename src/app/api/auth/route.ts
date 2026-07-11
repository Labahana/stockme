import { NextRequest, NextResponse } from "next/server";
import { sanitizeShop, shopify } from "@/lib/shopify";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const shop = sanitizeShop(request.nextUrl.searchParams.get("shop"));

  if (!shop) {
    return NextResponse.json({ error: "Invalid shop parameter" }, { status: 400 });
  }

  return shopify.auth.begin({
    shop,
    callbackPath: "/api/auth/callback",
    isOnline: false,
    rawRequest: request,
  });
}

export async function POST(request: NextRequest) {
  const shop = sanitizeShop(request.nextUrl.searchParams.get("shop"));

  if (!shop) {
    return NextResponse.json({ error: "Invalid shop parameter" }, { status: 400 });
  }

  return shopify.auth.begin({
    shop,
    callbackPath: "/api/auth/callback",
    isOnline: false,
    rawRequest: request,
  });
}
