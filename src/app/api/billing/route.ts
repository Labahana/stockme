import { NextRequest, NextResponse } from "next/server";
import { isNextResponse, resolveShopContext } from "@/lib/api/shop-context";
import { PLAN_TIERS } from "@/lib/constants";

export const dynamic = "force-dynamic";

// Billing endpoints disabled for initial dev/testing. The GET endpoint is kept
// as a lightweight install-check (resolveShopContext validates the session).
export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveShopContext(request, { skipBilling: true });
    if (isNextResponse(ctx)) return ctx;

    return NextResponse.json({
      hasActivePayment: true,
      billingStatus: "active",
      planTier: ctx.store.plan_tier,
      provider: "shopify",
      plans: PLAN_TIERS,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Billing status failed" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Billing is disabled for initial dev/testing.
  void request;
  return NextResponse.json({
    success: true,
    billingDisabled: true,
    message: "Billing is currently disabled.",
  });
}
